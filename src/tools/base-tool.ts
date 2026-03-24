import type { AgentAction } from "../types/actions.js";
import type { ActionResult } from "../types/agent.js";
import type { ToolContext, ToolExecutor } from "../types/tools.js";

/**
 * Abstract base for all tool executors.
 * Provides common patterns for logging and error handling.
 */
export abstract class BaseTool implements ToolExecutor {
  abstract readonly name: string;

  abstract execute(action: AgentAction, context: ToolContext): Promise<ActionResult>;

  /** Create a success result */
  protected success(action: AgentAction, result?: unknown): ActionResult {
    return {
      action,
      success: true,
      result,
      executed_at: new Date().toISOString(),
    };
  }

  /** Create a failure result */
  protected failure(action: AgentAction, error: string): ActionResult {
    return {
      action,
      success: false,
      error,
      executed_at: new Date().toISOString(),
    };
  }
}
