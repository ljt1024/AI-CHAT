const app = require('./app');
const { env } = require('./config/env');

function startServer() {
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
}

module.exports = {
  startServer,
};
