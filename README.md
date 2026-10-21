# PSG Transport Management Portal - Backend

This is the backend repository for the PSG Transport Management Portal. It is built using Node.js and Express.js and provides RESTful APIs for managing transportation services.

### Features
- User authentication and authorization
- CRUD operations for transportation requests
- Real-time updates on transportation status

### Stack
- Node.js
- Express.js
- MongoDB for database
- Mongoose for object data modeling

### Getting Started
To get started with the backend, follow these steps:

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```bash
    cd server
    ```

3. Install dependencies:
    ```bash
    npm install
    ```
4. Create a `.env` file in the root of the project and add the following environment variables:
```
PORT=5000
MONGO_URI=<your-mongodb-connection-string>
```
5. Start the development server:
    ```bash
    npm start
    ```
