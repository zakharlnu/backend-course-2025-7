FROM node:lts-alpine

WORKDIR /app

COPY package.json package.json
COPY package-lock.json package-lock.json

RUN npm install
RUN npm install -g nodemon

COPY . .

EXPOSE 8080

CMD ["nodemon", "main.js"]