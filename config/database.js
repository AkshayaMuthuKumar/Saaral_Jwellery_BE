const mysql = require('mysql2/promise');

// Create a connection pool with mysql2
// const db = mysql.createPool({
//   host: 'localhost',
//   user: 'root',
//   password: 'akshaya1907*', // Replace with your MySQL password
//   database: 'jewelry_shop',
//   waitForConnections: true,
// });

const db = mysql.createPool({
  host: 'btg0sxj4cdg2aizb2j9a-mysql.services.clever-cloud.com',
  user: 'uqonat92lueb1n93',
  password: 'uqonat92lueb1n93', // Replace with your MySQL password
  database: 'btg0sxj4cdg2aizb2j9a',
  waitForConnections: true,
});

const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  isAdmin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

const createProductsTable = `
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(255) NOT NULL UNIQUE, 
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INT NOT NULL,
  size VARCHAR(50),
  occasion VARCHAR(100),
  image VARCHAR(255) NOT NULL,
  INDEX (product_id)  
)`;

// Adding explicit indexes for all foreign keys
const createOccasions = `
CREATE TABLE IF NOT EXISTS occasions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  UNIQUE (name)
)`;

const createCategories = `
CREATE TABLE IF NOT EXISTS category (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(255) NOT NULL,
  subcategory_name VARCHAR(255) NOT NULL,
  image VARCHAR(255) NOT NULL,
  UNIQUE (subcategory_name)
)`;

const reviewTable = `
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  productId VARCHAR(255) NOT NULL,                         
  name VARCHAR(255) NOT NULL,                      
  email VARCHAR(255) NOT NULL,                    
  purchaseDate DATE NOT NULL,                     
  experience VARCHAR(255) NOT NULL,              
  rating INT CHECK (rating >= 1 AND rating <= 5), 
  review TEXT,                                   
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  FOREIGN KEY (productId) REFERENCES products(product_id) ON DELETE CASCADE
)`;

// Ensure user_id and product_id have explicit indexes
const createCartTable = `
CREATE TABLE IF NOT EXISTS cart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  size VARCHAR(50),
  quantity INT NOT NULL DEFAULT 0,
  price DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  image VARCHAR(255) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
  )`;


// Execute the queries to create the tables using async/await
const createTables = async () => {
  const tableQueries = [
    createUsersTable,
    createProductsTable,
    createOccasions,
    createCategories,
    reviewTable,
    createCartTable // Add the cart table creation query
  ];

  for (const tableQuery of tableQueries) {
    try {
      await db.query(tableQuery);
      console.log('Table created successfully');
    } catch (error) {
      console.error('Error creating table: ' + error.message);
    }
  }
};

createTables(); // Call the function to create tables

const generateProductId = async () => {
  // Use 'SARAL' as the prefix
  const prefix = 'SARAL';
  const tables = ['products']; // Add your relevant tables here

  let maxId = 0; // Initialize the max ID to zero

  // Loop through all tables to find the highest product_id with the given prefix
  for (const table of tables) {
    const [rows] = await db.query(`
          SELECT product_id
          FROM ${table}
          WHERE product_id LIKE '${prefix}%'`);

    // Extract the numeric portion from each product_id in the table and compare it to find the max
    const tableMaxId = rows.reduce((max, row) => {
      // Extract the numeric part of the product ID
      const numPart = parseInt(row.product_id.replace(prefix, ''), 10);
      return numPart > max ? numPart : max;
    }, 0);

    // Update the global maxId if the current table's max ID is greater
    if (tableMaxId > maxId) {
      maxId = tableMaxId;
    }
  }

  // If no IDs found, start from 1
  const newId = `${prefix}${String(maxId + 1).padStart(2, '0')}`;

  return newId;
};

module.exports = {
  pool: db, // No need to call .promise()
  generateProductId,
};
