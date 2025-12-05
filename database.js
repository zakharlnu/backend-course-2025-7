import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});


export async function insertInventoryItem(inventory_name, description, photo_filename, photo_url) {
  const query = `INSERT INTO inventory (inventory_name, description, photo_filename, photo_url)
                 VALUES ($1, $2, $3, $4) RETURNING *`;
  const values = [inventory_name, description, photo_filename, photo_url];
  const res = await pool.query(query, values);
  return res.rows[0];
}

export async function getAllInventoryItems() {
  const result = await pool.query('SELECT * FROM inventory');
  return result.rows;
}

export async function getInventoryItemById(id) {
  const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);
  return result.rows[0];
}

export async function updateInventoryItem(id, inventory_name, description) {
  const result = await pool.query(
    'UPDATE inventory SET inventory_name = $1, description = $2 WHERE id = $3 RETURNING *',
    [inventory_name, description, id]
  );
  return result.rows[0];
}

export async function updateInventoryItemPhoto(id, photo_filename, photo_url) {
  const result = await pool.query(
    'UPDATE inventory SET photo_filename = $1, photo_url = $2 WHERE id = $3 RETURNING *',
    [photo_filename, photo_url, id]
  );
  return result.rows[0];
}

export async function deleteInventoryItem(id) {
  const result = await pool.query('DELETE FROM inventory WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}



