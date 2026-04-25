FROM node:18 AS client-build

WORKDIR /app/client

COPY client/package*.json ./

RUN npm install

COPY client/ ./

RUN npm run build

FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 3000

CMD ["npm", "start"]