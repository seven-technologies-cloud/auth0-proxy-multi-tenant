import { Router } from 'express';
import rolesController from '../controllers/roles.controller.js';
import { authorize } from '../middleware/authz.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();

/**
 * Roles Routes
 * All routes require valid JWT authentication with proper audience and client_id
 */

// Apply authorization middleware to all role routes
router.use(authorize);

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Get roles with search and pagination
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search term for role name
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
 *         description: Number of roles per page (max 100)
 *       - in: query
 *         name: include_totals
 *         schema:
 *           type: boolean
 *         description: Include total count in response
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 */
router.get('/', asyncHandler(rolesController.getRoles.bind(rolesController)));

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     summary: Get a specific role by ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 *       404:
 *         description: Role not found
 */
router.get('/:id', asyncHandler(rolesController.getRole.bind(rolesController)));

/**
 * @swagger
 * /roles:
 *   post:
 *     summary: Create a new role (idempotent by name)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Role name (must be unique)
 *               description:
 *                 type: string
 *                 description: Role description
 *               permissions:
 *                 type: array
 *                 description: Array of permissions to assign to the role
 *                 items:
 *                   type: object
 *                   required:
 *                     - permission_name
 *                     - resource_server_identifier
 *                   properties:
 *                     permission_name:
 *                       type: string
 *                       description: Permission name
 *                     resource_server_identifier:
 *                       type: string
 *                       description: Resource server identifier
 *     responses:
 *       200:
 *         description: Role already exists (idempotent mode = return)
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Bad request - Missing required fields
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 *       409:
 *         description: Role already exists (idempotent mode = conflict)
 */
router.post('/', asyncHandler(rolesController.createRole.bind(rolesController)));

/**
 * @swagger
 * /roles/{id}:
 *   patch:
 *     summary: Update a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Role name
 *               description:
 *                 type: string
 *                 description: Role description
 *               permissions:
 *                 type: array
 *                 description: Array of permissions to assign to the role (replaces existing)
 *                 items:
 *                   type: object
 *                   required:
 *                     - permission_name
 *                     - resource_server_identifier
 *                   properties:
 *                     permission_name:
 *                       type: string
 *                       description: Permission name
 *                     resource_server_identifier:
 *                       type: string
 *                       description: Resource server identifier
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       400:
 *         description: Bad request - No valid fields to update
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 *       404:
 *         description: Role not found
 */
router.patch('/:id', asyncHandler(rolesController.updateRole.bind(rolesController)));

/**
 * @swagger
 * /roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID
 *     responses:
 *       204:
 *         description: Role deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 *       404:
 *         description: Role not found
 */
router.delete('/:id', asyncHandler(rolesController.deleteRole.bind(rolesController)));

export default router;