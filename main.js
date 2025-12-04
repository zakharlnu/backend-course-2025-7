import { program } from "commander";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import { randomUUID } from "node:crypto";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

program
  .requiredOption("-h, --host <host>", "host address")
  .requiredOption("-c, --cache <path>", "path to the input JSON file")
  .requiredOption("-p, --port <port>", "server port", (value) => {
    const parsed = Number(value);
    if (!parsed || parsed < 1 || parsed > 65535) {
      console.error("port must be number between 1 and 65535");
      process.exit(1);
    }
    return parsed;
  })
  .parse();

const opts = program.opts();

async function setupCacheDir(path) {
  try {
    await fs.mkdir(path, { recursive: true });
  } catch (error) {
    console.log(`error: ${error.message}`);
    process.exit(1);
  }
}

const cacheDir = path.resolve(opts.cache);
await setupCacheDir(cacheDir);

const inventoryList = [];
let idCounter = 1;
function generateId() {
  return idCounter++;
}

const BASE_URL = `http://${opts.host}:${opts.port}`;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("static"));
app.use("/photos", express.static(cacheDir));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, cacheDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = randomUUID();
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + extension);
  },
});
const upload = multer({ storage });

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory API",
      version: "1.0.0",
      description: "API documentation",
    },
    servers: [
      {
        url: BASE_URL,
      },
    ],
  },
  apis: ["./main.js"],
};

const swaggerSpecs = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         inventory_name:
 *           type: string
 *         description:
 *           type: string
 *         photo_filename:
 *           type: string
 *         photo_url:
 *           type: string
 */

/** 
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new inventory item
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - inventory_name
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Inventory registered successfully
 *       400:
 *         description: Bad request
 */
app.post("/register", upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;
  const photo = req.file;
  
  if (!inventory_name) {
    return res.status(400).json({ error: "inventory_name is required" });
  }
  
  const newId = generateId();
  const newItem = {
    id: newId,
    inventory_name,
    description: description || "",
    photo_filename: photo ? photo.filename : null,
    photo_url: photo ? `${BASE_URL}/inventory/${newId}/photo` : null,
  };

  inventoryList.push(newItem);

  res.status(201).json({ message: "inventory registered successfully" });
});

/**
 * @swagger
 * /inventory:
 *  get:
 *    summary: Get all inventory items
 *    responses:
 *      200:
 *        description: A list of inventory items
 *        content:
 *         application/json:
 *          schema:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/InventoryItem'
 *      404:
 *        description: No inventory items found
 */
app.get("/inventory", (req, res) => {
  if (inventoryList.length === 0) {
    return res.status(404).json({ error: "no inventory items found" });
  }
  
  res.status(200).json(inventoryList);
});

/**
 * @swagger
 * /inventory/{id}:
 *  get:
 *     summary: Get an inventory item by ID
 *     parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: integer
 *        description: The ID of the inventory item
 *     responses:
 *       200:
 *         description: Inventory item found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Inventory item not found
 */
app.get("/inventory/:id", (req, res) => {
  const itemId = Number(req.params.id);
  const item = inventoryList.find((i) => i.id === itemId);
  
  if (!item) {
    return res.status(404).json({ error: "inventory item not found" });
  }
  
  res.status(200).json(item);
});

/**
 * @swagger
 * /inventory/{id}:
 *  put:
 *     summary: Update an inventory item by ID
 *     parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: integer
 *        description: The ID of the inventory item
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Inventory item updated successfully
 *       404:
 *         description: Inventory item not found
 */
app.put("/inventory/:id", (req, res) => {
  const itemId = Number(req.params.id);
  const item = inventoryList.find((i) => i.id === itemId);
  
  if (!item) {
    return res.status(404).json({ error: "inventory item not found" });
  }
  
  const { inventory_name, description } = req.body;
  
  if (inventory_name) {
    item.inventory_name = inventory_name;
  }
  
  if (description) {
    item.description = description;
  }
  
  res.status(200).json({ message: "inventory item updated successfully" });
});

/**
* @swagger 
* /inventory/{id}:
*  delete:
*     summary: Delete an inventory item by ID
*     parameters:
*      - in: path
*        name: id
*        required: true
*        schema:
*          type: integer
*        description: The ID of the inventory item
*     responses:
*       200:
*         description: Inventory item deleted successfully
*       404:
*         description: Inventory item not found
*/
app.delete("/inventory/:id", (req, res) => {
  const itemId = Number(req.params.id);
  const itemIndex = inventoryList.findIndex((i) => i.id === itemId);
  
  if (itemIndex === -1) {
    return res.status(404).json({ error: "inventory item not found" });
  }
  
  const [deletedItem] = inventoryList.splice(itemIndex, 1);
  
  if (deletedItem.photo_filename) {
    const photoPath = path.join(cacheDir, deletedItem.photo_filename);
    fs.unlink(photoPath).catch((err) => {
      console.error(`failed to delete photo file: ${err.message}`);
    });
  }
  
  res.status(200).json({ message: "inventory item deleted successfully" });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *  get:
 *     summary: Get the photo of an inventory item by ID
 *     parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: integer
 *        description: The ID of the inventory item
 *     responses:
 *       200:
 *         description: Photo retrieved successfully
 *         content:
 *          image/jpeg:
 *           schema:
 *              format: binary
 *       404:
 *         description: Inventory item or photo not found
 */
app.get("/inventory/:id/photo", (req, res) => {
  const itemId = Number(req.params.id);
  const item = inventoryList.find((i) => i.id === itemId);
  
  if (!item) {
    return res.status(404).json({ error: "inventory item not found" });
  }
  
  if (!item.photo_filename) {
    return res
      .status(404)
      .json({ error: "photo not found for this inventory item" });
  }
  
  const photoPath = path.join(cacheDir, item.photo_filename);
  
  res.setHeader("Content-Type", "image/jpeg");
  res.sendFile(photoPath);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *  put:
 *     summary: Update the photo of an inventory item by ID
 *     parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: integer
 *        description: The ID of the inventory item
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Photo updated successfully
 *       404:
 *         description: Inventory item not found
 */ 
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const itemId = Number(req.params.id);
  const item = inventoryList.find((i) => i.id === itemId);
  
  if (!item) {
    return res.status(404).json({ error: "inventory item not found" });
  }
  
  const photo = req.file;
  
  if (!photo) {
    return res.status(400).json({ error: "photo file is required" });
  }
  
  if (item.photo_filename) {
    const oldPhotoPath = path.join(cacheDir, item.photo_filename);
    fs.unlink(oldPhotoPath).catch((err) => {
      console.error(`failed to delete old photo file: ${err.message}`);
    });
  }
  
  item.photo_filename = photo.filename;
  item.photo_url = `${BASE_URL}/inventory/${itemId}/photo`;
  
  res.status(200).json({ message: "photo updated successfully" });
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Search for an inventory item by ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: integer
 *               includePhoto:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Inventory item found
 *       400:
 *         description: Bad request
 *       404:
 *         description: Inventory item not found
 */
app.post("/search", (req, res) => {
  const { id, includePhoto } = req.body;
  const itemId = Number(id);
  console.log(includePhoto);
  
  if (!itemId) {
    return res.status(400).json({ error: "id is required" });
  }

  const item = inventoryList.find((i) => i.id === itemId);
  
  if (!item) {
    return res.status(404).json({ error: "inventory item not found" });
  }

  const result = { ...item };

  if (includePhoto == "on") {
    if (result.photo_filename) {
      result.description += ` ${result.photo_url}`;
    }
  }
  res.status(200).json(result);
});

app.use((req, res) => {
  res.status(405).json({ error: "Method not allowed" });
});

app.listen(opts.port, opts.host, () => {
  console.log(`server is running at http://${opts.host}:${opts.port}`);
});
