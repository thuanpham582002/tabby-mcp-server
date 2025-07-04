import { z } from 'zod';

/**
 * Standard MCP response content types
 * Must match the MCP SDK expected format
 */
export type McpTextContent = { 
  [x: string]: unknown;
  type: "text"; 
  text: string;
};

export type McpImageContent = { 
  [x: string]: unknown;
  type: "image"; 
  data: string; 
  mimeType: string;
};

export type McpResourceContent = { 
  [x: string]: unknown;
  type: "resource"; 
  resource: { 
    [x: string]: unknown;
    text: string; 
    uri: string; 
    mimeType?: string; 
  } | { 
    [x: string]: unknown;
    uri: string; 
    blob: string; 
    mimeType?: string; 
  };
};

export type McpContent = McpTextContent | McpImageContent | McpResourceContent;

/**
 * Standard MCP response format
 * Must match the MCP SDK expected format
 */
export interface McpResponse {
  [x: string]: unknown;
  content: McpContent[];
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

/**
 * Success response helper
 */
export function createSuccessResponse(text: string, metadata?: Record<string, any>): McpResponse {
  return {
    content: [{
      type: "text",
      text
    }],
    _meta: metadata
  };
}

/**
 * JSON response helper
 */
export function createJsonResponse(data: any): McpResponse {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(data, null, 2)
    }]
  };
}

/**
 * Error response helper
 */
export function createErrorResponse(errorMessage: string): McpResponse {
  return {
    content: [{
      type: "text",
      text: errorMessage
    }],
    isError: true
  };
}

/**
 * Interface for defining a structured response section
 */
export interface ResponseSection {
  /** The header/title for this section (optional) */
  header?: string;
  /** The content for this section */
  content: string;
  /** Whether to include this section (default: true if content is provided) */
  include?: boolean;
}

/**
 * Example usage of the flexible structured response API:
 *
 * // Using the array-based API for custom sections:
 * createStructuredResponse([
 *   { header: "Analysis Results", content: "Data processed successfully" },
 *   { header: "Details", content: "Found 42 items", include: true },
 *   { header: "Warnings", content: "No warnings", include: false }
 * ]);
 *
 * // Using the builder pattern:
 * new StructuredResponseBuilder()
 *   .addSection("Status", "Operation completed")
 *   .addSectionIf(hasErrors, "Errors", errorList)
 *   .addContent("Raw output without header")
 *   .build();
 *
 * // Backward compatibility (existing code continues to work):
 * createStructuredResponse(executionResults, commandOutput, additionalInfo);
 */

/**
 * Generic structured response helper
 * Creates a response with organized sections for better LLM processing
 */
export function createStructuredResponse(sections: ResponseSection[]): McpResponse;
export function createStructuredResponse(
  executionResults: string,
  commandOutput: string,
  additionalInfo?: string
): McpResponse;
export function createStructuredResponse(
  sectionsOrExecutionResults: ResponseSection[] | string,
  commandOutput?: string,
  additionalInfo?: string
): McpResponse {
  let sections: ResponseSection[];

  // Handle backward compatibility - if first parameter is string, use legacy format
  if (typeof sectionsOrExecutionResults === 'string') {
    sections = [
      {
        header: "Command Execution Results",
        content: sectionsOrExecutionResults,
        include: true
      },
      {
        header: "Command Output",
        content: commandOutput!,
        include: true
      }
    ];

    if (additionalInfo) {
      sections.push({
        header: "Additional Information",
        content: additionalInfo,
        include: true
      });
    }
  } else {
    sections = sectionsOrExecutionResults;
  }

  const content: McpTextContent[] = [];

  for (const section of sections) {
    // Skip section if explicitly marked as not included or if content is empty
    if (section.include === false || !section.content?.trim()) {
      continue;
    }

    const text = section.header
      ? `## ${section.header}\n${section.content}`
      : section.content;

    content.push({
      type: "text",
      text
    });
  }

  return {
    content
  };
}

/**
 * Builder class for creating structured responses with a fluent API
 */
export class StructuredResponseBuilder {
  private sections: ResponseSection[] = [];

  /**
   * Add a section to the response
   */
  addSection(header: string, content: string, include: boolean = true): this {
    this.sections.push({ header, content, include });
    return this;
  }

  /**
   * Add a section without a header
   */
  addContent(content: string, include: boolean = true): this {
    this.sections.push({ content, include });
    return this;
  }

  /**
   * Conditionally add a section
   */
  addSectionIf(condition: boolean, header: string, content: string): this {
    if (condition) {
      this.addSection(header, content);
    }
    return this;
  }

  /**
   * Add command execution results section (convenience method)
   */
  addExecutionResults(content: string): this {
    return this.addSection("Command Execution Results", content);
  }

  /**
   * Add command output section (convenience method)
   */
  addCommandOutput(content: string): this {
    return this.addSection("Command Output", content);
  }

  /**
   * Add additional information section (convenience method)
   */
  addAdditionalInfo(content: string, include: boolean = true): this {
    return this.addSection("Additional Information", content, include);
  }

  /**
   * Build the final McpResponse
   */
  build(): McpResponse {
    return createStructuredResponse(this.sections);
  }

  /**
   * Reset the builder to start fresh
   */
  reset(): this {
    this.sections = [];
    return this;
  }
}

/**
 * A generic MCP tool definition
 */
export interface McpTool<T> {
  /**
   * The name of the tool
   */
  name: string;

  /**
   * The description of the tool
   */
  description: string;

  /**
   * The Zod schema for validating tool arguments
   * This should be a record of Zod validators
   * For tools with no parameters, use {} (empty object)
   */
  schema: Record<string, z.ZodType<any>> | undefined;
  
  /**
   * The handler function for the tool
   */
  handler: (args: T, extra: any) => Promise<McpResponse>;
}

/**
 * Base interface for tool categories
 */
export interface ToolCategory {
  /**
   * The name of the category
   */
  name: string;

  /**
   * List of MCP tools in this category
   */
  readonly mcpTools: McpTool<any>[];
}