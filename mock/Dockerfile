FROM node:20-alpine

WORKDIR /app

# Copy mock package files
COPY package.json ./
RUN npm install

COPY . .

EXPOSE 8080 8081

CMD ["npx", "tsx", "index.ts"]
