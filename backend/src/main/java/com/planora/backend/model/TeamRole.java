// Defines the permission tiers available for team membership; enforced across role-change and remove operations.
package com.planora.backend.model;

public enum TeamRole {
    OWNER,   // Project creator; has full control and cannot be demoted.
    ADMIN,   // Can manage MEMBER and VIEWER roles but cannot promote to OWNER or ADMIN.
    MEMBER,  // Standard collaborator with task-level access.
    VIEWER   // Read-only access; cannot modify team data.
}
