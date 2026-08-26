FROM node:20-alpine

WORKDIR /app

# Install native dependencies for sqlite3 and build tools
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

EXPOSE 5000

CMD ["npm", "start"]
