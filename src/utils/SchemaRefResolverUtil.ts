/* eslint-disable @typescript-eslint/no-explicit-any */

import { JsonSchema } from "../beans/JsonSchema.js";

/**
 * Utility class for resolving JSON Schema $ref pointers
 */
export class SchemaRefResolverUtil {
    /**
     * Recursively resolves local $ref if present, returning the *real* schema node.
     * If no $ref is present, returns the original node.
     */
    public static resolveIfRef(node: JsonSchema | null, rootSchema: JsonSchema): JsonSchema | null {
        // Defensive: null checks
        if (!node) {
            return node;
        }

        // While we have a $ref in the node, follow it
        while (node.$ref) {
            const ref = node.$ref;
            // Typically something like "#/definitions/block_name_hash"
            if (ref.startsWith('#/')) {
                // eslint-disable-next-line no-param-reassign
                node = this.resolvePointer(ref.substring(2), rootSchema);
            } else {
                // We'll assume local references only.
                throw new Error(`Unsupported $ref format (expected local ref): ${ref}`);
            }
        }

        return node;
    }

    /**
     * Resolve something like "definitions/block_name_hash" within the rootSchema.
     */
    private static resolvePointer(pointer: string, rootSchema: Record<string, any>): Record<string, any> {
        const parts = pointer.split('/');
        let current = rootSchema;
        for (const part of parts) {
            current = current[part];
            if (!current) {
                throw new Error(`Could not resolve pointer: ${pointer}`);
            }
        }
        return current;
    }
}
