const { GraphQLServer } = require('graphql-yoga');
const { Prisma } = require('prisma-binding');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { APP_SECRET, getUserId } = require('./utils');

const resolvers = {
  Subscription: {
    newLink: {
      subscribe: (parent, args, ctx, info) => ctx.db.subscription.link({}, info),
    },
    newVote: {
      subscribe: (parent, args, ctx, info) => ctx.db.subscription.vote({}, info),
    },
  },
  Query: {
    feed(parent, { filter, first, skip }, ctx, info) {
      const where = filter
        ? { OR: [{ url_contains: filter }, { description_contains: filter }] }
        : {};

      return ctx.db.query.links({ first, skip, where }, info);
    },
  },
  Mutation: {
    async vote(parent, { linkId }, ctx, info) {
      const userId = getUserId(ctx);
      const linkExists = await ctx.db.exists.Vote({
        user: { id: userId },
        link: { id: linkId },
      });
      if (linkExists) {
        throw new Error(`Already voted for link: ${linkId}`);
      }

      return ctx.db.mutation.createVote(
        {
          data: {
            user: { connect: { id: userId } },
            link: { connect: { id: linkId } },
          },
        },
        info,
      );
    },
    post(parent, { url, description }, ctx, info) {
      const userId = getUserId(ctx);
      return ctx.db.mutation.createLink(
        { data: { url, description, postedBy: { connect: { id: userId } } } },
        info,
      );
    },
    async signup(parent, args, ctx) {
      const password = await bcrypt.hash(args.password, 10);
      const user = await ctx.db.mutation.createUser({
        data: { ...args, password },
      });

      const token = jwt.sign({ userId: user.id }, APP_SECRET);

      return {
        token,
        user,
      };
    },
    async login(parent, args, ctx) {
      const user = await ctx.db.query.user({ where: { email: args.email } });
      if (!user) {
        throw new Error(`Could not find user with email: ${args.email}`);
      }

      const valid = await bcrypt.compare(args.password, user.password);
      if (!valid) {
        throw new Error('Invalid password');
      }

      const token = jwt.sign({ userId: user.id }, APP_SECRET);

      return {
        token,
        user,
      };
    },
  },
};

const server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers,
  context: req => ({
    ...req,
    db: new Prisma({
      typeDefs: 'src/generated/prisma.graphql',
      endpoint: 'https://us1.prisma.sh/public-ringthief-327/hackernews/dev', // the endpoint of the Prisma DB service
      secret: 'mysecret123', // specified in database/prisma.yml
      debug: true, // log all GraphQL queryies & mutations
    }),
  }),
});

server.start(() => console.log('Server is running on http://localhost:4000'));
