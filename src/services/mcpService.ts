import { Injectable } from '@angular/core';

import { ExecToolCategory } from '../tools/terminal';
import { ToolCategory } from '../type/types';

import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from 'zod';
import { IncomingMessage, ServerResponse } from 'http';
import { ConfigService } from 'tabby-core';
import * as http from 'http';
import { McpLoggerService } from './mcpLogger.service';
import { log } from 'console';

/**
 * The main MCP server service for Tabby
 * Combines both MCP and HTTP server functionality
 */
@Injectable({ providedIn: 'root' })
export class McpService {
  private server: McpServer;
  private transports: { [sessionId: string]: SSEServerTransport } = {};
  private app: express.Application;
  private isRunning = false;
  private toolCategories: ToolCategory[] = [];
  private httpServer: http.Server;
  // Interval for SSE keep-alive comments. Keeps idle proxies/NAT from reaping
  // the stream and lets a failed write reveal a dead socket. See issue #8.
  private readonly SSE_HEARTBEAT_INTERVAL_MS = 15000;

  constructor(
    public config: ConfigService,
    private execToolCategory: ExecToolCategory,
    private logger: McpLoggerService
  ) {
    // Initialize MCP Server
    this.server = new McpServer({
      name: "Tabby",
      version: "1.0.0"
    });

    // Register tool categories
    // this.registerToolCategory(this.tabToolCategory);
    this.registerToolCategory(this.execToolCategory);
    
    // Configure Express
    this.configureExpress();
  }

  /**
   * Register a tool category with the MCP server
   */
  private registerToolCategory(category: ToolCategory): void {
    this.toolCategories.push(category);
    
    // Register all tools from the category
    category.mcpTools.forEach(tool => {
      const inputSchema = (tool.schema || {}) as z.ZodRawShape;

      this.server.tool(
        tool.name,
        tool.description,
        inputSchema,
        async (args, extra) => tool.handler(args, extra)
      );

      this.logger.info(`Registered tool: ${tool.name} from category: ${category.name} with schema: ${JSON.stringify(inputSchema)}`);
    });
  }

  /**
   * Configure Express server
   */
  private configureExpress(): void {
    this.app = express();
    // this.app.use(cors());
    // DO NOT ENABLE express.json() - MCP server handles JSON parsing 
    // IT WILL CAUSE PROBLEMS : MCP: Failed to reload client: Error POSTing to endpoint (HTTP 400): InternalServerError: stream is not readable
    // this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (_, res) => {
      res.status(200).send('OK');
    });

    this.app.get("/sse", async (req: Request, res: Response) => {
      this.logger.info("Establishing new SSE connection");
      const transport = new SSEServerTransport(
        "/messages",
        res as unknown as ServerResponse<IncomingMessage>,
      );
      const sessionId = transport.sessionId;
      this.logger.info(`New SSE connection established for sessionId ${sessionId}`);

      this.transports[sessionId] = transport;

      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const cleanup = () => {
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = undefined;
        }
        if (this.transports[sessionId]) {
          delete this.transports[sessionId];
          this.logger.info(`SSE connection closed for sessionId ${sessionId}`);
        }
      };

      res.on("close", cleanup);
      res.on("error", (err) => {
        this.logger.error(`SSE connection error for sessionId ${sessionId}:`, err);
        cleanup();
      });

      // Connect first so the SDK writes the SSE headers and initial endpoint
      // event before we emit any keep-alive comments.
      await this.server.connect(transport);

      // Periodic SSE comment keeps the stream alive across idle gaps (e.g. while
      // a long command runs) and surfaces a dead socket via a failed write,
      // instead of silently writing a tool result into a closed connection.
      heartbeat = setInterval(() => {
        try {
          if (!res.write(": ping\n\n") && (res.writableEnded || res.destroyed)) {
            cleanup();
          }
        } catch (err) {
          this.logger.error(`SSE heartbeat failed for sessionId ${sessionId}:`, err);
          cleanup();
        }
      }, this.SSE_HEARTBEAT_INTERVAL_MS);
    });

    this.app.post("/messages", async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      if (!this.transports[sessionId]) {
        res.status(400).send(`No transport found for sessionId ${sessionId}`);
        return;
      }
      this.logger.info(`Received message for sessionId ${sessionId}`);
      await this.transports[sessionId].handlePostMessage(req, res);
    });
  
    // Configure API endpoints for tool access via HTTP
    this.configureToolEndpoints();
  }

  /**
   * Configure API endpoints for tool access via HTTP
   */
  private configureToolEndpoints(): void {
    console.log('Configuring tool endpoints...');
    // Add API endpoints for each tool for direct HTTP access
    this.toolCategories.forEach(category => {
      category.mcpTools.forEach(tool => {
        console.log(`Configuring endpoint for tool: ${tool.name}`);
        this.app.post(`/api/tool/${tool.name}`, express.json(), async (req: Request, res: Response) => {
          try {
            // Explicitly cast the body to any to match the handler's expected parameter type
            const params: any = req.body;
            this.logger.info(`Executing tool ${tool.name} with params: ${JSON.stringify(params)}`);  
            const result = await tool.handler(params, {});
            res.json(result);
          } catch (error) {
            this.logger.error(`Error executing tool ${tool.name}:`, error);
            res.status(500).json({ error: error.message });
          }
        });
      });
    });
  }

  /**
   * Initialize the MCP service
   */
  public initialize(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create and start the HTTP server
        const httpServer = http.createServer(this.app);

        // Start the server
        httpServer.listen(port, () => {
          this.logger.info(`[MCP Service] MCP server listening on port ${port}`);
          this.isRunning = true;
          this.httpServer = httpServer;
          resolve();
        });

        // Handle server errors
        httpServer.on('error', (err) => {
          this.logger.error('[MCP Service] MCP server error:', err);
          this.isRunning = false;
          reject(err);
        });
      } catch (err) {
        this.logger.error('[MCP Service] Failed to initialize MCP server:', err);
        this.isRunning = false;
        reject(err);
      }
    });
  }

  /**
   * Start the MCP server
   * This is a convenience method for the UI
   */
  public async startServer(port: number): Promise<void> {
    return this.initialize(port);
  }

  /**
   * Stop the MCP service
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.info('[MCP Service] Not running');
      return;
    }

    try {
      // Close all active transports
      Object.values(this.transports).forEach(transport => {
        transport.close();
      });
      
      if (this.httpServer) {
        this.httpServer.close();
      }
      
      this.isRunning = false;
      this.logger.info('[MCP Service] MCP server stopped');
    } catch (err) {
      this.logger.error('[MCP Service] Failed to stop MCP server:', err);
      throw err;
    }
  }

  /**
   * Stop the MCP server
   * This is a convenience method for the UI
   */
  public async stopServer(): Promise<void> {
    return this.stop();
  }

  /**
   * Check if the MCP server is running
   * @returns true if the server is running, false otherwise
   */
  public isServerRunning(): boolean {
    return this.isRunning;
  }
}

// Export types for tools
export * from '../type/types';