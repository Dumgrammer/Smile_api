require('dotenv').config();
const http = require('http');
const app = require('./app');
const port = process.env.PORT;

const server = http.createServer(app);

server.listen(port || 8080, () => {
    console.log(`MA Florencio Dental Clinic listening on port ${port}!`)
});