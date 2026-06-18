// Stockfish Web Worker wrapper
// Loads the Stockfish lite-single engine and handles UCI communication

// Catch any unhandled errors
self.onerror = function(msg, file, line, col, err) {
  postMessage('STOCKFISH_ERROR: ' + msg + ' at ' + file + ':' + line);
};

// Load the stockfish engine
try {
  importScripts('/stockfish/stockfish.js');
} catch(e) {
  postMessage('STOCKFISH_LOAD_ERROR: ' + e.message);
}
