import {
  AI_MAX_HISTORY_TEXT_LENGTH,
  AI_MAX_MESSAGE_TEXT_LENGTH,
  AI_MAX_MESSAGES,
  AI_MAX_USER_MESSAGE_LENGTH,
  type AiChatMessage,
  type AiChatRequest,
  type AiLocale,
  type AiProposalOutcome,
} from "@schemaforge/api-contract";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from "class-validator";

import { RawValue } from "../../../common/raw-value.decorator.js";

const AI_LOCALES = ["vi", "en"] as const satisfies readonly AiLocale[];
const AI_MESSAGE_ROLES = [
  "user",
  "assistant",
] as const satisfies readonly AiChatMessage["role"][];
const AI_PROPOSAL_OUTCOMES = [
  "accepted",
  "discarded",
] as const satisfies readonly AiProposalOutcome[];

export class AiChatMessageDto implements AiChatMessage {
  @IsIn(AI_MESSAGE_ROLES)
  readonly role!: AiChatMessage["role"];

  @IsString()
  @Length(1, AI_MAX_MESSAGE_TEXT_LENGTH)
  readonly text!: string;

  @IsOptional()
  @IsIn(AI_PROPOSAL_OUTCOMES)
  readonly proposalOutcome?: AiProposalOutcome;
}

/**
 * Rules across the message list (AI-R21): the last message is the user's new
 * message within `AI_MAX_USER_MESSAGE_LENGTH`, only assistant messages carry a
 * proposal outcome, and the whole history stays within
 * `AI_MAX_HISTORY_TEXT_LENGTH`. Malformed lists pass here because the
 * per-field validators already reject them.
 */
@ValidatorConstraint({ name: "aiChatMessages" })
export class AiChatMessagesRule implements ValidatorConstraintInterface {
  validate(messages: unknown): boolean {
    if (!Array.isArray(messages) || !messages.every(isChatMessage)) {
      return true;
    }
    const last = messages.at(-1);
    if (last === undefined) {
      return true;
    }
    const historyLength = messages.reduce(
      (total, message) => total + message.text.length,
      0,
    );
    return (
      last.role === "user" &&
      last.text.length <= AI_MAX_USER_MESSAGE_LENGTH &&
      messages.every(
        (message) =>
          message.proposalOutcome === undefined || message.role === "assistant",
      ) &&
      historyLength <= AI_MAX_HISTORY_TEXT_LENGTH
    );
  }

  defaultMessage(): string {
    return "messages must end with a user message and stay within the AI history limits";
  }
}

function isChatMessage(value: unknown): value is AiChatMessageDto {
  return value instanceof AiChatMessageDto && typeof value.text === "string";
}

/** The document structure is checked by `@schemaforge/core`, not by class-validator. */
export class AiChatRequestDto implements AiChatRequest {
  @IsObject()
  @RawValue()
  readonly document!: unknown;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(AI_MAX_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  @Validate(AiChatMessagesRule)
  readonly messages!: readonly AiChatMessageDto[];

  @IsIn(AI_LOCALES)
  readonly locale!: AiLocale;
}
