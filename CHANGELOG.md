# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-06-01

### Changed
- Merged PR #9 from wolgy/fix/sse-heartbeat — adds SSE heartbeat keep-alive and dead-connection cleanup to prevent proxy/NAT timeouts.

## [1.0.2] - 2026-06-01

### Changed
- Promoted the plugin to the first stable npm release available for publishing.
- Refreshed README with production-focused setup and SSE client examples.
- Simplified command boundary markers to a compact tmux-mcp-style protocol.

### Fixed
- Fixed no-argument MCP tool registration for `get_ssh_session_list`.
- Pinned MCP/Zod dependencies for compatibility with Tabby's TypeScript build toolchain.
- Made Docker builds more reliable by skipping unnecessary Electron binary downloads.

## [0.0.2] - 2025-06-27

### Added
- Pair Programming Mode with confirmation dialog
- Command History tracking and management
- Command Output Storage with pagination support
- STDIO bridge for connecting to MCP server

### Fixed
- JSON syntax errors in README examples
- Terminal buffer retrieval for long outputs
- Command execution feedback mechanism

## [0.0.1] - 2025-04-12

### Added
- Initial release of Tabby-MCP
- MCP server implementation for Tabby terminal
- Terminal control capabilities for AI assistants
- SSH session management tools
- Terminal buffer access functionality
- Command execution and abortion tools
- Configuration options for MCP servers