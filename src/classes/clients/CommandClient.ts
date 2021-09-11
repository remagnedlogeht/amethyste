import { startBot } from "../../../deps.ts";
import { executeNormalCommand } from "../../monitors/mod.ts";
import {
  CommandClientOptions,
  Command,
  CommandClientEvents,
} from "../../types/mod.ts";
import { AmethystCollection } from "../../utils/mod.ts";
import { ArgumentGenerator } from "../arguments/ArgumentGenerator.ts";
import { CommandClass } from "../mod.ts";
import { SimpleClient } from "./SimpleClient.ts";

/** The client that is used for creating commands  */
export class CommandClient extends SimpleClient {
  /** The bot's prefix */
  public readonly prefix: CommandClientOptions["prefix"];
  /** A collection that keeps all the bot's commands */
  // deno-lint-ignore no-explicit-any
  public readonly commands: AmethystCollection<string, Command<any>> =
    new AmethystCollection();
  /** A collection of arguments */
  public readonly argumentGenerator: ArgumentGenerator =
    new ArgumentGenerator();
  /** The client's options */
  public readonly options: CommandClientOptions;
  /** Checks whether the bot should only respond to commands in guilds */
  public readonly guildsOnly: boolean;
  /** Checks whether the bot should only respond to commands in dms */
  public readonly dmsOnly: boolean;
  /** A list of user ids that can surpass cooldowns */
  public readonly ignoreCooldown: bigint[];
  /** The default cooldown amount */
  public readonly defaultCooldown: unknown;
  /** An object that contains all the command client's event functions */
  public eventHandlers: Partial<CommandClientEvents> = {};
  constructor(options: CommandClientOptions) {
    super(options);
    this.prefix = options.prefix;
    this.options = options;
    if (options.dmOnly && options.guildOnly)
      throw "The command client can't be dms only and guilds only at the same time";
    this.guildsOnly = options.guildOnly ?? false;
    this.dmsOnly = options.dmOnly ?? false;
    this.ignoreCooldown = options.ignoreCooldown?.map((e) => BigInt(e)) ?? [];
  }

  /** Creates a command */
  // deno-lint-ignore no-explicit-any
  addCommand(command: Command<any>): void {
    this.commands.set(command.name, {
      ...command,
      category: command.category || "misc",
    });
    this.eventHandlers.commandAdd?.(command);
  }

  /** Deletes a command */
  // deno-lint-ignore no-explicit-any
  deleteCommand(command: Command<any>) {
    this.commands.delete(command.name);
    this.eventHandlers.commandRemove?.(command);
  }

  /** Loads a command file */
  async load(dir: string) {
    const Class = await import(`file://${Deno.realPathSync(dir)}`);
    if (!Class.default) return;
    // deno-lint-ignore no-explicit-any
    const returned: CommandClass<any> = new Class.default();
    this.addCommand(returned);
    return returned;
  }

  /** Load all commands in a directory */
  async loadAll(path: string): Promise<void> {
    path = path.replaceAll("\\", "/");
    const files = Deno.readDirSync(Deno.realPathSync(path));
    for (const file of files) {
      if (!file.name) continue;
      const currentPath = `${path}/${file.name}`;
      if (file.isFile) {
        if (!currentPath.endsWith(".ts")) continue;
        await this.load(currentPath);
        continue;
      }
      this.loadAll(currentPath);
    }
  }

  /** Start the bot */
  async start(): Promise<void> {
    if (!this.guildsOnly && !this.options.intents.includes("DirectMessages"))
      this.options.intents.push("DirectMessages");
    if (!this.dmsOnly && !this.options.intents.includes("GuildMessages"))
      this.options.intents.push("GuildMessages");
    if (this.options.dirs)
      for (const dir of Object.values(this.options.dirs)) {
        await this.loadAll(dir);
      }
    return await startBot({
      ...this.options,
      eventHandlers: {
        ...this.eventHandlers,
        messageCreate: (message) => {
          executeNormalCommand(this, message);
          this.eventHandlers.messageCreate?.(message);
        },
      },
    });
  }
}
