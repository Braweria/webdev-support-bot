const Discord = require('discord.js');
const fetch = require('node-fetch');
const DOMParser = require('dom-parser');
const Entities = require('html-entities').Html5Entities;
const { KEYWORDS, ERRORS, RESULT_AMOUNT_THRESHOLDS } = require('./constants');

const client = new Discord.Client();
const entities = new Entities();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.once('ready', () => {
  client.user.setActivity('you code...', {
    type: 'WATCHING',
  });
});

/**
 *
 * @param {Discord.Message} msg
 */
const handleMessage = async msg => {
  if (!msg.content.startsWith(KEYWORDS.initial)) {
    return;
  }

  let search = msg.content.substr(KEYWORDS.initial.length);

  // empty query (although Discord trims messages by default)
  // or call for help
  if (search.length === 0 || search === 'help') {
    msg.reply(
      'Usage: `!mdn <search term, e.g. localStorage>` (optional: `--results=<number between 1 and 10>`)',
    );
    return;
  }

  let amountOfResultsToShow = RESULT_AMOUNT_THRESHOLDS.default;

  // a hint will only be shown if the bot wasn't already called with it
  const withResultArgumentHint =
    search.indexOf(KEYWORDS.resultsArgument) === -1;

  // called with --result argument
  if (!withResultArgumentHint) {
    const parts = search.split(KEYWORDS.resultsArgument);

    search = parts[0];
    amountOfResultsToShow = parseResultAmount(parts[1]);
  }

  try {
    const searchUrl = getSearchUrl(encodeURI(search));
    const response = await fetch(searchUrl);

    if (!response.ok) {
      msg.reply(ERRORS.invalidResponse);
      return;
    }

    const text = await response.text();

    const parser = new DOMParser();
    const document = parser.parseFromString(text);

    // meta provides information about the amount of results found
    const meta = document.getElementsByClassName('result-meta')[0].textContent;
    if (meta.startsWith('0 documents found')) {
      msg.reply(ERRORS.noResults(search));
      return;
    }

    const results = document
      .getElementsByClassName('result')
      .slice(0, amountOfResultsToShow);

    // respond directly to the user
    if (amountOfResultsToShow === 1) {
      const { url } = extractTitleAndUrlFromResult(results[0]);

      msg.reply(url);
      return;
    }

    let description = results.reduce((carry, result, index) => {
      const { title, url } = extractTitleAndUrlFromResult(result);

      carry += `${index + 1}. ${createMarkdownLink(title, url)}\n`;

      return carry;
    }, '');

    if (withResultArgumentHint) {
      description +=
        '\n :wrench:  *show up to 10 results by appending `--results=<number>` to your request*';
    }

    description += '\n :bulb:  *react with a number to filter your result*';

    const sentMsg = await msg.channel.send({
      embed: {
        title: `MDN results for *${search}*`,
        color: 0x83d0f2, // MDN landing page color
        url: searchUrl,
        footer: {
          icon_url: 'https://avatars0.githubusercontent.com/u/7565578',
          text: createFooter(meta.split('for')[0], amountOfResultsToShow),
        },
        description,
      },
    });

    try {
      /**
       * @var {Discord.Collection<Discord.Snowflake, Discord.MessageReaction>} collectedReactions
       */
      const collectedReactions = await sentMsg.awaitReactions(
        reactionFilterBuilder(amountOfResultsToShow, msg.author.id),
        {
          max: 1,
          time: 60 * 1000,
          errors: ['time'],
        },
      );

      const emojiName = collectedReactions.first().emoji.name;

      const index = validReactions.findIndex(emoji => emoji === emojiName);
      const chosenResult = results[index];

      const { url } = extractTitleAndUrlFromResult(chosenResult);

      // overwrite previous embed
      sentMsg.edit(url, { embed: null });
    } catch (collected) {
      // nobody reacted, doesn't matter
    }
  } catch (error) {
    console.error(error);
    msg.reply(ERRORS.unknownError);
  }
};

const validReactions = [
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '4️⃣',
  '5️⃣',
  '6️⃣',
  '7️⃣',
  '8️⃣',
  '9️⃣',
  '🔟',
];

/**
 *
 * @param {any} result [document.parseFromString return type]
 */
const extractTitleAndUrlFromResult = result => {
  const titleElement = result.getElementsByClassName('result-title')[0];

  const title = entities.decode(titleElement.textContent);
  const url = buildDirectUrl(titleElement.getAttribute('href'));

  return {
    title,
    url,
  };
};

/**
 *
 * @param {number} amountOfResultsToShow
 */
const reactionFilterBuilder = (amountOfResultsToShow, messageAuthorId) => (
  reaction,
  user,
) =>
  user.id === messageAuthorId &&
  validReactions
    .reduce(
      (carry, reaction) =>
        carry.length < amountOfResultsToShow ? [...carry, reaction] : carry,
      [],
    )
    .includes(reaction.emoji.name);

/**
 *
 * @param {string} title
 * @param {string} url
 */
const createMarkdownLink = (title, url) =>
  `[${title}](${url.replace(/\)/g, '\\)')})`;

/**
 *
 * @param {string} search
 */
const getSearchUrl = search =>
  `https://developer.mozilla.org/en-US/search?q=${search}`;

/**
 *
 * @param {string} href
 */
const buildDirectUrl = href => `https://developer.mozilla.org${href}`;

/**
 *
 * @param {string} metaText
 * @param {number} amountOfResultsToShow
 */
const createFooter = (metaText, amountOfResultsToShow) =>
  `${metaText} - showing ${amountOfResultsToShow} of 10 first-page results`;

/**
 *
 * @param {string} givenValue
 */
const parseResultAmount = givenValue => {
  const argument = Number(givenValue);

  if (Number.isNaN(argument)) {
    return RESULT_AMOUNT_THRESHOLDS.default;
  }

  if (argument > RESULT_AMOUNT_THRESHOLDS.max) {
    return RESULT_AMOUNT_THRESHOLDS.max;
  }

  if (argument < RESULT_AMOUNT_THRESHOLDS.min) {
    return RESULT_AMOUNT_THRESHOLDS.min;
  }

  return argument;
};

client.on('message', handleMessage);

client.login(process.env.DISCORD_TOKEN);
