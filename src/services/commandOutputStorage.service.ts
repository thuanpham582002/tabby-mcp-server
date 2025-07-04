import { Injectable } from '@angular/core';
import { McpLoggerService } from './mcpLogger.service';

/**
 * Interface for stored command output
 */
export interface StoredCommandOutput {
  id: string;
  command: string;
  output: string;
  promptShell: string | null; // keeping for backward compatibility with stored data
  exitCode: number | null;
  timestamp: number;
  aborted: boolean;
  tabId: number;
}

/**
 * Service for storing and retrieving command outputs
 * Uses in-memory storage for simplicity, but could be extended to use a database
 */
@Injectable({ providedIn: 'root' })
export class CommandOutputStorageService {
  // In-memory storage for command outputs
  private outputs: Map<string, StoredCommandOutput> = new Map();

  constructor(private logger: McpLoggerService) {
    this.logger.info('CommandOutputStorageService initialized');
  }

  /**
   * Store a command output
   * @param data Command output data
   * @returns The ID of the stored output
   */
  storeOutput(data: Omit<StoredCommandOutput, 'id'>): string {
    // Generate a unique ID based on timestamp and random string
    const id = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Store the output with the generated ID
    this.outputs.set(id, { ...data, id });
    
    this.logger.info(`Stored command output with ID: ${id}, command: ${data.command}, output length: ${data.output.length}`);
    
    // Clean up old outputs if there are too many (keep the 100 most recent)
    if (this.outputs.size > 100) {
      const oldestKeys = Array.from(this.outputs.keys()).sort((a, b) => {
        return this.outputs.get(a)!.timestamp - this.outputs.get(b)!.timestamp;
      }).slice(0, this.outputs.size - 100);
      
      oldestKeys.forEach(key => this.outputs.delete(key));
      this.logger.info(`Cleaned up ${oldestKeys.length} old command outputs`);
    }
    
    return id;
  }

  /**
   * Get a stored command output
   * @param id The ID of the stored output
   * @returns The stored output or null if not found
   */
  getOutput(id: string): StoredCommandOutput | null {
    const output = this.outputs.get(id);
    if (!output) {
      this.logger.warn(`Command output with ID ${id} not found`);
      return null;
    }
    return output;
  }

  /**
   * Get a paginated portion of a stored command output
   * @param id The ID of the stored output
   * @param startLine The starting line number (1-based)
   * @param maxLines The maximum number of lines to return
   * @returns The paginated output data or null if not found
   */
  getPaginatedOutput(id: string, startLine: number = 1, maxLines: number = 250): { 
    lines: string[]; 
    totalLines: number; 
    part: number; 
    totalParts: number;
    command: string;
    exitCode: number | null;
    promptShell: string | null;
    aborted: boolean;
  } | null {
    const output = this.getOutput(id);
    if (!output) {
      return null;
    }

    // Split the output into lines
    const lines = output.output.split('\n');
    const totalLines = lines.length;
    
    // Calculate total parts
    const totalParts = Math.ceil(totalLines / maxLines);
    
    // Calculate the part number based on the starting line
    const part = Math.ceil(startLine / maxLines);
    
    // Calculate start and end indices
    const startIdx = Math.max(0, startLine - 1);
    const endIdx = Math.min(startIdx + maxLines, totalLines);
    
    // Extract the requested lines
    const paginatedLines = lines.slice(startIdx, endIdx);
    
    return {
      lines: paginatedLines,
      totalLines,
      part,
      totalParts,
      command: output.command,
      exitCode: output.exitCode,
      promptShell: output.promptShell,
      aborted: output.aborted
    };
  }
}
