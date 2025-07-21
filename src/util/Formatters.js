'use strict';
const {
  blockQuote,
  bold,
  channelMention,
  codeBlock,
  formatEmoji,
  hideLinkEmbed,
  hyperlink,
  inlineCode,
  italic,
  quote,
  roleMention,
  spoiler,
  strikethrough,
  time,
  TimestampStyles,
  underscore,
  userMention,
} = require('@discordjs/builders');
class Formatters extends null {}
Formatters.blockQuote = blockQuote;
Formatters.bold = bold;
Formatters.channelMention = channelMention;
Formatters.chatInputApplicationCommandMention = function chatInputApplicationCommandMention(
  commandName,
  subcommandGroupOrSubOrId,
  subcommandNameOrId,
  commandId,
) {
  if (typeof commandId !== 'undefined') {
    return `</${commandName} ${subcommandGroupOrSubOrId} ${subcommandNameOrId}:${commandId}>`;
  }
  if (typeof subcommandNameOrId !== 'undefined') {
    return `</${commandName} ${subcommandGroupOrSubOrId}:${subcommandNameOrId}>`;
  }
  return `</${commandName}:${subcommandGroupOrSubOrId}>`;
};
Formatters.codeBlock = codeBlock;
Formatters.formatEmoji = formatEmoji;
Formatters.hideLinkEmbed = hideLinkEmbed;
Formatters.hyperlink = hyperlink;
Formatters.inlineCode = inlineCode;
Formatters.italic = italic;
Formatters.quote = quote;
Formatters.roleMention = roleMention;
Formatters.spoiler = spoiler;
Formatters.strikethrough = strikethrough;
Formatters.time = time;
Formatters.TimestampStyles = TimestampStyles;
Formatters.underscore = underscore;
Formatters.userMention = userMention;
module.exports = Formatters;
