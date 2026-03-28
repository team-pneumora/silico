import type { AgentAction, AgentActionType } from "../types/actions.js";
import { ACTION_TOOL_MAP } from "../types/actions.js";
import type { AgentConfig, CompanyState } from "../types/state.js";
import { DEFAULT_TRADING_LIMITS, SURVIVAL_MODE_THRESHOLD } from "../types/state.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Validators");

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate an action before execution.
 * Checks: tool permissions, trading limits, spending limits, role restrictions.
 */
export function validateAction(
  action: AgentAction,
  agent: AgentConfig,
  state: CompanyState
): ValidationResult {
  // 1. Tool permission check (dynamic, from agent_tools table)
  const requiredTool = ACTION_TOOL_MAP[action.type as AgentActionType];
  if (requiredTool) {
    const hasTool = agent.tools.some((t) => t.tool_name === requiredTool);
    if (!hasTool) {
      const reason = `${agent.role} "${agent.name}" does not have access to tool: ${requiredTool}`;
      logger.warn(reason);
      return { valid: false, reason };
    }
  }

  // 2. Hire/fire only for CEO role
  if ((action.type === "hire_agent" || action.type === "fire_agent") && agent.role !== "CEO") {
    return { valid: false, reason: "Only CEO can hire/fire agents" };
  }

  // 3. Trade execution requires CEO directive (for non-CEO agents)
  if (action.type === "execute_trade" && agent.role !== "CEO") {
    if (!action.directive_from) {
      return { valid: false, reason: "Trade execution requires a CEO directive reference" };
    }
  }

  // 4. Trading validation
  if (action.type === "trading_decision" || action.type === "execute_trade") {
    const spendingCheck = validateSpending(state);
    if (!spendingCheck.valid) return spendingCheck;
    return validateTrade(action, state);
  }

  return { valid: true };
}

/** Validate trading limits */
function validateTrade(action: AgentAction, state: CompanyState): ValidationResult {
  const limits = DEFAULT_TRADING_LIMITS;

  if (action.type !== "trading_decision" && action.type !== "execute_trade") {
    return { valid: true };
  }

  const amount = action.amount_usd;
  const leverage = action.leverage;

  // Max single position
  const maxSingle = state.trading_balance * limits.max_single_position_ratio;
  if (amount > maxSingle) {
    return {
      valid: false,
      reason: `Position $${amount} exceeds max $${maxSingle.toFixed(2)} (${limits.max_single_position_ratio * 100}% of balance)`,
    };
  }

  // Max total exposure
  const currentExposure = state.open_positions.reduce((sum, p) => sum + p.amount_usd, 0);
  const maxExposure = state.trading_balance * limits.max_total_exposure_ratio;
  if (currentExposure + amount > maxExposure) {
    return {
      valid: false,
      reason: `Total exposure $${(currentExposure + amount).toFixed(2)} exceeds max $${maxExposure.toFixed(2)}`,
    };
  }

  // Max leverage
  if (leverage > limits.max_leverage) {
    return { valid: false, reason: `Leverage ${leverage}x exceeds max ${limits.max_leverage}x` };
  }

  // Stop-loss required + reward:risk ratio
  if (action.type === "trading_decision") {
    if (action.stop_loss_pct <= 0) {
      return { valid: false, reason: "Stop-loss is required" };
    }
    const ratio = action.take_profit_pct / action.stop_loss_pct;
    if (ratio < limits.min_reward_risk_ratio) {
      return {
        valid: false,
        reason: `Reward:risk ${ratio.toFixed(1)} below min ${limits.min_reward_risk_ratio}:1`,
      };
    }
  }

  return { valid: true };
}

/** Check survival mode */
function validateSpending(state: CompanyState): ValidationResult {
  if (state.treasury_usd < SURVIVAL_MODE_THRESHOLD) {
    return {
      valid: false,
      reason: `SURVIVAL MODE: Treasury $${state.treasury_usd.toFixed(2)} < $${SURVIVAL_MODE_THRESHOLD}`,
    };
  }
  return { valid: true };
}
