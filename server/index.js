    const express = require('express');
    const app = express();
    const port = 3000; // Or any desired port

    // Define a basic route
    app.get('/', (req, res) => {
      res.send('Hello from Express!');
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });