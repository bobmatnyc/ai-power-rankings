# Development Server with Automatic Port Detection

## Overview

The AI Power Rankings project includes an enhanced development server that automatically finds an available port when the default ports are in use. This prevents conflicts with other services and provides a smoother development experience.

## Features

- **Automatic Port Detection**: Scans ports 3000-3100 to find an available one
- **Process Information**: Shows what process is using occupied ports
- **Configurable Port Range**: Customize the port range via environment variables
- **Force Specific Port**: Option to require a specific port
- **Process Management**: Can detect and optionally kill existing Next.js processes
- **Colored Output**: Clear, colored console messages for better visibility

## Usage

### Basic Usage

Simply run the development server as usual:

```bash
npm run dev
```

The server will:
1. Check if port 3000 is available
2. If not, scan through ports 3001-3100
3. Use the first available port found
4. Display what's using occupied ports

### Configuration

Create or edit `.env.development` to customize behavior:

```bash
# Set the port range to scan
DEV_PORT_START=3000
DEV_PORT_END=3100

# Force a specific port (uncomment to use)
# PORT=3005
```

### Command Line Options

```bash
# Use the enhanced dev server (default)
npm run dev

# Use the original Next.js dev command
npm run dev:default
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Force a specific port | None (auto-detect) |
| `DEV_PORT_START` | First port to check | 3000 |
| `DEV_PORT_END` | Last port to check | 3100 |

## Example Output

```
🚀 AI Power Rankings Development Server

🔍 Scanning ports 3000-3100 for availability...
⚠️  Port 3000 is in use by node (PID: 12345)
⚠️  Port 3001 is in use by Code Helper (PID: 23456)
✅ Found available port: 3002
📍 Starting Next.js on http://localhost:3002
💡 Tip: Set PORT=3002 in .env.development to always use this port
```

## Troubleshooting

### Port Still in Use

If you get an error that a port is still in use:

1. The script will show what process is using it
2. You can manually kill the process: `kill -9 <PID>`
3. Or let the script detect and offer to kill Next.js processes

### Permission Errors

On macOS/Linux, you might need to make the script executable:

```bash
chmod +x scripts/dev-server.js
```

### Can't Find Available Port

If no ports are available in the range:

1. Increase the range in `.env.development`
2. Or manually kill some processes
3. Or force a specific port that you know is free

## Technical Details

The dev server script:
- Uses Node.js `net` module to check port availability
- Uses `lsof` command to identify processes (macOS/Linux)
- Spawns Next.js as a child process with the selected port
- Handles graceful shutdown on SIGINT/SIGTERM

## Benefits

1. **No More Port Conflicts**: Automatically finds an available port
2. **Better DX**: Clear messages about what's using ports
3. **Flexible Configuration**: Easy to customize via environment variables
4. **Process Visibility**: Know exactly what's running on which port
5. **Team Friendly**: Different developers can run on different ports simultaneously