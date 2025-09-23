const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TestFleet Control Server',
      version: '1.0.0',
      description: 'API documentation'
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server'
      }
    ]
  },
  apis: [
    './server/src/routes/*.js'
  ]
};

const specs = swaggerJsdoc(swaggerOptions);

const setupSwagger = (app) => {
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(specs));
};

module.exports = { setupSwagger };