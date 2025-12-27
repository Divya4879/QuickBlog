#!/bin/bash

# QuickBlog Local Testing Commands

echo "🚀 Starting QuickBlog locally..."

# 1. Kill any existing processes
echo "Cleaning up existing processes..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "python.*http.server" 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

# Wait for cleanup
sleep 2

# 2. Start the API server (Redis Cloud backend)
echo "Starting API server on port 3001..."
cd /home/divya/QuickBlog
nohup node server.js > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for API server to initialize..."
sleep 5

# 3. Start the frontend server
echo "Starting frontend server on port 8000..."
nohup python3 -m http.server 8000 > frontend.log 2>&1 &
FRONTEND_PID=$!

# 4. Test connections
echo "Testing connections..."
sleep 3

# Test API server multiple times
API_HEALTHY=false
for i in {1..5}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ API Server: http://localhost:3001 (healthy)"
        API_HEALTHY=true
        break
    else
        echo "⏳ API Server starting... (attempt $i/5)"
        sleep 2
    fi
done

if [ "$API_HEALTHY" = false ]; then
    echo "❌ API Server failed to start"
    echo "Check server.log for errors:"
    tail -10 server.log
fi

if curl -s http://localhost:8000 > /dev/null 2>&1; then
    echo "✅ Frontend: http://localhost:8000 (ready)"
else
    echo "❌ Frontend failed to start"
fi

echo ""
echo "🎉 QuickBlog is ready!"
echo "📱 Open: http://localhost:8000"
echo "🔧 API: http://localhost:3001"
echo "📊 Health: http://localhost:3001/health"
echo ""
echo "📝 Logs:"
echo "  API: tail -f server.log"
echo "  Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop servers:"
echo "  pkill -f 'node server.js'"
echo "  pkill -f 'python.*http.server'"
echo "  Or: kill $SERVER_PID $FRONTEND_PID"
