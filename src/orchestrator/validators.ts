import type { AgentAction } from "../types/actions.js";
import type { AgentRole, CompanyState } from "../types/state.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Validators");

const CEO_ONLY_ACTIONS = new Set([
  "trading_decision",
  "send_email",
  "calendar_event",
]);

const VALID_ACTION_TYPES = new Set([
  "read_messages",
  "send_message",
  "create_task",
  "update_task",
  "web_search",
  "trading_decision",
  "execute_trade",
  "check_positions",
  "github_create_repo",
  "vercel_deploy",
  "send_email",
  "calendar_event",
  "log_decision",
  "update_company_state",
]);

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateAction(
  action: AgentAction,
  role: AgentRole,
  state: CompanyState
): ValidationResult {
  // Unknown action type
  if (!VALID_ACTION_TYPES.has(action.type)) {
    logger.warn(`Unknown action type: ${action.type}`);
    return { valid: false, reason: `Unknown action type: ${action.type}` };
  }

  // Role-based restrictions
  if (CEO_ONLY_ACTIONS.has(action.type) && role !== "CEO") {
    logger.warn(`${role} attempted CEO-only action: ${action.type}`);
    return {
      valid: false,
      reason: `Action "${action.type}" is restricted to CEO only`,
    };
  }

  // Trading validations
  if (action.type === "trading_decision") {
    return validateTradingDecision(action, state);
  }

  if (action.type === "execute_trade") {
    return validateTradeExecution(action, role, state);
  }

  // Spending check (survival mode)
  if (state.treasury_usd < 10) {
    const spendingActions = new Set([
      "trading_decision",
      "execute_trade",
      "send_email",
    ]);
    if (spendingActions.has(action.type)) {
      logger.warn("SURVIVAL MODE: Blocking spending action");
      return {
        valid: false,
        reason: "Treasury below $10 — survival mode active. No new spending allowed.",
      };
    }
  }

  return { valid: true };
}

function validateTradingDecision(
  action: AgentAction & { type: "trading_decision" },
  state: CompanyState
): ValidationResult {
  const maxSinglePosition = state.trading_balance * 0.3;
  if (action.amount_usd > maxSinglePosition) {
    return {
      valid: false,
      reason: `Position $${action.amount_usd} exceeds 30% limit ($${maxSinglePosition.toFixed(2)})`,
    };
  }

  const currentExposure = state.open_positions.reduce(
    (sum, p) => sum + p.amount_usd,
    0
  );
  const maxExposure = state.trading_balance * 0.7;
  if (currentExposure + action.amount_usd > maxExposure) {
    return {
      valid: false,
      reason: `Total exposure would exceed 70% limit ($${maxExposure.toFixed(2)})`,
    };
  }

  if (action.leverage > 10) {
    return {
      valid: false,
      reason: `Leverage ${action.leverage}x exceeds maximum 10x`,
    };
  }

  if (!action.stop_loss_pct || action.stop_loss_pct <= 0) {
    return {
      valid: false,
      reason: "Stop-loss is mandatory for all trades",
    };
  }

  if (action.stop_loss_pct > 5) {
    return {
      valid: false,
      reason: `Stop-loss ${action.stop_loss_pct}% exceeds maximum 5%`,
    };
  }

  const rewardRiskRatio = action.take_profit_pct / action.stop_loss_pct;
  if (rewardRiskRatio < 2) {
    return {
      valid: false,
      reason: `Reward:risk ratio ${rewardRiskRatio.toFixed(1)}:1 is below minimum 2:1`,
    };
  }

  return { valid: true };
}

function validateTradeExecution(
  action: AgentAction & { type: "execute_trade" },
  role: AgentRole,
  state: CompanyState
): ValidationResult {
  if (role === "Developer" && !action.directive_from) {
    return {
      valid: false,
      reason: "Developer must reference CEO directive to execute trades",
    };
  }

  const maxSinglePosition = state.trading_balance * 0.3;
  if (action.amount_usd > maxSinglePosition) {
    return {
      valid: false,
      reason: `Trade amount $${action.amount_usd} exceeds 30% limit`,
    };
  }

  return { valid: true };
}
