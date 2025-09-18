import { Router } from 'express';
import usersController from '../controllers/users.controller.js';
import { authorize } from '../middleware/authz.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();

/**
 * Users Routes
 * All routes require valid JWT authentication with proper audience and client_id
 */

// Apply authorization middleware to all user routes
router.use(authorize);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get users with search and pagination
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Simple search term (will be wrapped in wildcards)
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Lucene query syntax for advanced search
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Page number (0-based)
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of users per page (max 100)
 *       - in: query
 *         name: include_totals
 *         schema:
 *           type: boolean
 *         description: Include total count in response
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort field and order (e.g., "email:1", "created_at:-1")
 *       - in: query
 *         name: connection
 *         schema:
 *           type: string
 *         description: Filter by connection name
 *       - in: query
 *         name: fields
 *         schema:
 *           type: string
 *         description: Comma-separated list of fields to include
 *       - in: query
 *         name: include_fields
 *         schema:
 *           type: boolean
 *         description: Whether to include (true) or exclude (false) specified fields
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 */
router.get('/', asyncHandler(usersController.getUsers.bind(usersController)));

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a specific user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID (can be Auth0 user_id or email)
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 *       404:
 *         description: User not found
 */
router.get('/:id', asyncHandler(usersController.getUser.bind(usersController)));

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user (idempotent by email)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - connection
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               connection:
 *                 type: string
 *                 description: Auth0 connection name
 *               password:
 *                 type: string
 *                 description: User password (required for database connections)
 *               given_name:
 *                 type: string
 *               family_name:
 *                 type: string
 *               name:
 *                 type: string
 *               nickname:
 *                 type: string
 *               picture:
 *                 type: string
 *                 format: uri
 *               user_metadata:
 *                 type: object
 *                 description: Custom user metadata
 *               email_verified:
 *                 type: boolean
 *               phone_number:
 *                 type: string
 *               phone_verified:
 *                 type: boolean
 *               blocked:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User already exists (idempotent mode = return)
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Bad request - Missing required fields
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 *       409:
 *         description: User already exists (idempotent mode = conflict)
 */
router.post('/', asyncHandler(usersController.createUser.bind(usersController)));

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               email_verified:
 *                 type: boolean
 *               phone_number:
 *                 type: string
 *               phone_verified:
 *                 type: boolean
 *               given_name:
 *                 type: string
 *               family_name:
 *                 type: string
 *               name:
 *                 type: string
 *               nickname:
 *                 type: string
 *               picture:
 *                 type: string
 *                 format: uri
 *               user_metadata:
 *                 type: object
 *                 description: Custom user metadata
 *               blocked:
 *                 type: boolean
 *               verify_email:
 *                 type: boolean
 *                 description: Send verification email after update
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Bad request - No valid fields to update
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 *       404:
 *         description: User not found
 */
router.patch('/:id', asyncHandler(usersController.updateUser.bind(usersController)));

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       204:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 *       404:
 *         description: User not found
 */
router.delete('/:id', asyncHandler(usersController.deleteUser.bind(usersController)));

export default router;