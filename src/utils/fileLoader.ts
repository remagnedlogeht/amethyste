import { CommandClass } from "../classes/Command.ts";
import { AmethystBot } from "../interfaces/bot.ts";
import { AmethystError } from "../interfaces/errors.ts";
import { AmethystEvent, AmethystEvents } from "../interfaces/event.ts";
import { CommandOptions } from "../types/commandOptions.ts";
import { RecAsyncGen } from "./types.ts";

interface Module extends Record<string, unknown> {
  default?: unknown;
}

export async function* load<T extends Module>(dir: string): RecAsyncGen<T> {
  for await (const file of Deno.readDir(dir)) {
    if (file.isDirectory) {
      yield* load(`./${dir}/${file.name}`);
      continue;
    }
    const module = await import(
      `file://${Deno.realPathSync(`${dir}/${file.name}`)}`
    );
    yield module as T;
  }
}

export async function loadEvents(bot: AmethystBot, dir: string) {
  const eventFiles = load<{ default?: AmethystEvent<keyof AmethystEvents> }>(
    dir
  );
  for await (const eventFile of eventFiles) {
    if (eventFile.default) {
      bot.on(eventFile.default.name, eventFile.default.execute);
    }
  }
}

// Just for test
// Soon enough there will be just 1 command type that has support for both slash and message command
export async function loadCommands(bot: AmethystBot, dir: string) {
  const commandFiles = load<{ default?: CommandOptions }>(dir);
  for await (const commandFile of commandFiles) {
    if (commandFile.default) {
      bot.amethystUtils.createCommand(commandFile.default);
    }
  }
}

interface inhibitor {
  name: string;
  execute: <T extends CommandClass = CommandClass>(
    bot: AmethystBot,
    command: T,
    options?: { memberId?: bigint; guildId?: bigint; channelId: bigint }
  ) => Promise<true | AmethystError>;
}

export async function loadInhibitors(bot: AmethystBot, dir: string) {
  const inhibitorFiles = load<{ default?: inhibitor }>(dir);
  for await (const inhibitorFile of inhibitorFiles) {
    if (inhibitorFile.default) {
      bot.inhibitors.set(
        inhibitorFile.default.name,
        inhibitorFile.default.execute
      );
    }
  }
}
