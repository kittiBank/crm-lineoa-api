# CRM LINE OA API

A comprehensive CRM system API built with NestJS for managing LINE Official Account interactions.

## Features

- ✅ User Authentication & Authorization (JWT)
- ✅ LINE Bot Integration
- ✅ Message Management
- ✅ Campaign Management
- ✅ Database with Prisma ORM
- ✅ API Documentation with Swagger
- ✅ Microservices support (RabbitMQ/AMQP)
- ✅ Security (Helmet, Compression)
- ✅ Logging with Pino
- ✅ Input Validation

## Tech Stack

- **Framework**: NestJS 10.0
- **Language**: TypeScript 5.3
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Passport
- **Message Queue**: RabbitMQ (AMQP)
- **LINE Bot SDK**: @line/bot-sdk 8.4
- **API Documentation**: Swagger/OpenAPI
- **Security**: Helmet, Compression
- **Logging**: Pino with Pino Pretty
- **Validation**: Class Validator & Transformer

## Project Structure

```
src/
├── main.ts                      # Application entry point
├── app.module.ts                # Root module
├── app.controller.ts            # Root controller
├── app.service.ts               # Root service
├── prisma/
│   ├── prisma.module.ts         # Prisma module
│   └── prisma.service.ts        # Prisma service
└── modules/
    ├── auth/                    # Authentication module
    │   ├── auth.module.ts
    │   ├── auth.service.ts
    │   ├── auth.controller.ts
    │   ├── strategies/
    │   │   └── jwt.strategy.ts
    │   └── dto/
    │       └── login.dto.ts
    ├── users/                   # Users management module
    │   ├── users.module.ts
    │   ├── users.service.ts
    │   ├── users.controller.ts
    │   └── dto/
    │       └── create-user.dto.ts
    ├── line/                    # LINE Bot integration module
    │   ├── line.module.ts
    │   ├── line.service.ts
    │   └── line.controller.ts
    ├── messages/                # Messages management module
    │   ├── messages.module.ts
    │   ├── messages.service.ts
    │   ├── messages.controller.ts
    │   └── dto/
    │       └── create-message.dto.ts
    └── campaigns/               # Campaigns management module
        ├── campaigns.module.ts
        ├── campaigns.service.ts
        ├── campaigns.controller.ts
        └── dto/
            ├── create-campaign.dto.ts
            └── update-campaign.dto.ts

prisma/
├── schema.prisma                # Database schema
├── migrations/                  # Database migrations
└── seed.ts                      # Database seed (optional)
```

## Prerequisites

- Node.js >= 18
- npm >= 9
- PostgreSQL >= 12

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd crm-lineoa-api
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/crm_lineoa_db

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRATION=7d

# LINE BOT
LINE_BOT_CHANNEL_ACCESS_TOKEN=your_line_bot_token_here
LINE_BOT_CHANNEL_SECRET=your_line_bot_secret_here

# AMQP (RabbitMQ)
AMQP_URL=amqp://guest:guest@localhost:5672

# Logging
LOG_LEVEL=debug
```

4. Setup the database:
```bash
npm run db:generate
npm run db:push
```

## Running the Application

### Development
```bash
npm run start:dev
```

### Production
```bash
npm run build
npm run start:prod
```

### Debug Mode
```bash
npm run start:debug
```

## Available Scripts

- `npm run build` - Build the application
- `npm run start` - Start the application
- `npm run start:dev` - Start with watch mode
- `npm run start:debug` - Start with debugging
- `npm run start:prod` - Start production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage
- `npm run test:e2e` - Run end-to-end tests
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Create database migration
- `npm run db:studio` - Open Prisma Studio

## API Documentation

Once the application is running, access the Swagger documentation at:
```
http://localhost:3000/docs
```

## Database Schema

The project includes the following models:
- **User** - User accounts with authentication
- **LineUser** - LINE users following the bot
- **Message** - Messages from LINE users
- **Campaign** - Marketing campaigns

View and modify the schema in `prisma/schema.prisma`.

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. 

1. Register a new user:
```bash
POST /api/v1/auth/register
```

2. Login to get access token:
```bash
POST /api/v1/auth/login
```

3. Use the token in Authorization header:
```bash
Authorization: Bearer <access_token>
```

## LINE Bot Integration

The LINE webhook endpoint is available at:
```
POST /api/v1/line/webhook
```

Webhook signature validation is implemented to ensure requests are from LINE.

## Modules

### Auth Module
- User registration and login
- JWT token generation and validation
- Passport JWT strategy

### Users Module
- User profile management
- User listing and retrieval

### LINE Module
- LINE Bot SDK integration
- Webhook handling
- Message sending
- Profile retrieval

### Messages Module
- Message storage and retrieval
- Mark messages as read
- User message history

### Campaigns Module
- Campaign creation and management
- Campaign status tracking
- Campaign scheduling

## Development Tips

### Generate a New Module
```bash
nest g module modules/feature-name
nest g service modules/feature-name
nest g controller modules/feature-name
```

### Create a Database Migration
```bash
npm run db:migrate
# Follow the prompts to name your migration
```

### Access Prisma Studio
```bash
npm run db:studio
```

This opens an interactive database browser.

## Testing

Run the test suite:
```bash
npm test
```

With coverage:
```bash
npm run test:cov
```

## Docker Support (Optional)

To add Docker support, create a `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

## Troubleshooting

### Database connection issues
- Ensure PostgreSQL is running
- Check DATABASE_URL in `.env`
- Verify database exists or run `npm run db:push`

### PORT already in use
- Change the PORT in `.env`
- Or kill the process using the port

### Prisma generation issues
```bash
npm run db:generate
```

## Best Practices

1. **Environment Variables** - Never commit `.env` file
2. **Validation** - Use DTOs with class-validator
3. **Error Handling** - Use NestJS exception filters
4. **Logging** - Use injected Logger service
5. **Security** - Always validate user input
6. **Database** - Use Prisma for type-safe queries
7. **API Documentation** - Keep Swagger comments updated

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## Support

For issues and questions, please open an issue on the repository.

## License

This project is licensed under the UNLICENSED license.
