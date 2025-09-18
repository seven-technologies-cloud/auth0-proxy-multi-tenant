import { Router } from 'express';
import userRolesController from '../controllers/userRoles.controller.js';
import { authorize } from '../middleware/authz.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();

/**
 * User Roles Routes
 * All routes require valid JWT authentication with proper audience and client_id
 */

// Apply authorization middleware to all user role routes
router.use(authorize);

/**
 * @swagger
 * /users/{id}/roles:
 *   get:
 *     summary: Get roles assigned to a user
 *     tags: [User Roles]
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
 *       200:
 *         description: User roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 *       404:
 *         description: User not found
 */
router.get('/:id/roles', asyncHandler(userRolesController.getUserRoles.bind(userRolesController)));

/**
 * @swagger
 * /users/{id}/roles:
 *   post:
 *     summary: Assign roles to a user (idempotent)
 *     tags: [User Roles]
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
 *             required:
 *               - roleIds
 *             properties:
 *               roleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of role IDs to assign
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Roles assigned successfully (includes idempotent cases)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 assignedRoles:
 *                   type: integer
 *                   description: Total number of roles requested
 *                 newAssignments:
 *                   type: integer
 *                   description: Number of new role assignments
 *                 alreadyAssigned:
 *                   type: integer
 *                   description: Number of roles already assigned
 *                 roles:
 *                   type: array
 *                   description: Current assigned roles
 *       400:
 *         description: Bad request - Invalid roleIds
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 *       404:
 *         description: User or role not found
 */
router.post('/:id/roles', asyncHandler(userRolesController.assignUserRoles.bind(userRolesController)));

/**
 * @swagger
 * /users/{id}/roles:
 *   delete:
 *     summary: Remove roles from a user (idempotent)
 *     tags: [User Roles]
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
 *             required:
 *               - roleIds
 *             properties:
 *               roleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of role IDs to remove
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Roles removed successfully (includes idempotent cases)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 requestedRemovals:
 *                   type: integer
 *                   description: Total number of roles requested for removal
 *                 actualRemovals:
 *                   type: integer
 *                   description: Number of roles actually removed
 *                 notAssigned:
 *                   type: integer
 *                   description: Number of roles that were not assigned
 *                 remainingRoles:
 *                   type: array
 *                   description: Remaining assigned roles
 *       400:
 *         description: Bad request - Invalid roleIds
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Client not in allowlist
 *       404:
 *         description: User not found
 */
router.delete('/:id/roles', asyncHandler(userRolesController.removeUserRoles.bind(userRolesController)));

export default router;