/**
 * Examples demonstrating the flexible structured response API
 */

import { createStructuredResponse, StructuredResponseBuilder, ResponseSection } from '../src/type/types';

// Example 1: Using the array-based API for custom sections
function createAnalysisResponse(data: any[], errors: string[], warnings: string[]) {
  const sections: ResponseSection[] = [
    {
      header: "Analysis Summary",
      content: `Processed ${data.length} items successfully`
    },
    {
      header: "Data Details", 
      content: data.map(item => `- ${item.name}: ${item.status}`).join('\n')
    },
    {
      header: "Errors",
      content: errors.join('\n'),
      include: errors.length > 0
    },
    {
      header: "Warnings",
      content: warnings.join('\n'), 
      include: warnings.length > 0
    }
  ];

  return createStructuredResponse(sections);
}

// Example 2: Using the builder pattern for dynamic content
function createDynamicResponse(config: { includeDebug: boolean; hasErrors: boolean }) {
  const builder = new StructuredResponseBuilder()
    .addSection("Operation Status", "Completed successfully")
    .addSectionIf(config.hasErrors, "Error Details", "Multiple validation errors found")
    .addContent("Raw output data without header");

  if (config.includeDebug) {
    builder.addSection("Debug Information", "Execution time: 1.2s\nMemory usage: 45MB");
  }

  return builder.build();
}

// Example 3: Backward compatibility - existing code continues to work
function createLegacyResponse(executionResults: string, output: string, additionalInfo?: string) {
  return createStructuredResponse(executionResults, output, additionalInfo);
}

// Example 4: Mixed usage with conditional sections
function createFileProcessingResponse(files: string[], processed: number, failed: string[]) {
  return new StructuredResponseBuilder()
    .addSection("File Processing Results", 
      `Total files: ${files.length}\n` +
      `Successfully processed: ${processed}\n` +
      `Failed: ${failed.length}`
    )
    .addSection("Processed Files", 
      files.slice(0, processed).map(f => `✓ ${f}`).join('\n')
    )
    .addSectionIf(failed.length > 0, "Failed Files",
      failed.map(f => `✗ ${f}`).join('\n')
    )
    .addSectionIf(failed.length === 0, "Success Message", 
      "All files processed successfully!"
    )
    .build();
}

// Example 5: Custom sections without headers
function createRawDataResponse(sections: string[]) {
  const responseSections: ResponseSection[] = sections.map(content => ({
    content,
    include: content.trim().length > 0
  }));

  return createStructuredResponse(responseSections);
}

export {
  createAnalysisResponse,
  createDynamicResponse, 
  createLegacyResponse,
  createFileProcessingResponse,
  createRawDataResponse
};
