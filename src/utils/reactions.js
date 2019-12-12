const validReactions = {
  deletion: '❌',
  // order is important here
  indices: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'],
};

const reactionCache = [...validReactions.indices, validReactions.deletion];

/**
 *
 * @param {string} initialMessageAuthorId
 */
const reactionFilterBuilder = initialMessageAuthorId => (
  { emoji: { name } },
  user,
) =>
  user.id === initialMessageAuthorId &&
  // validate reaction via whitelist
  reactionCache.includes(name);

const awaitReactionConfig = {
  max: 1,
  time: 60 * 1000,
  errors: ['time'],
};

module.exports = {
  validReactions,
  reactionCache,
  reactionFilterBuilder,
  awaitReactionConfig,
};
