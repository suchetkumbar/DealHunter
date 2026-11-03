import { initBotId } from "botid/client/core";

// Invisible bot challenge for the two API routes (free "basic" mode). In local development it's a no-op.
initBotId({
  protect: [
    { path: "/api/analyze", method: "POST" },
    { path: "/api/places", method: "GET" },
  ],
});
