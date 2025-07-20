FROM --platform=amd64 ghcr.io/puppeteer/puppeteer:latest

WORKDIR /home/pptruser

# selectively copy the source files
COPY ./package.json .
COPY ./package-lock.json .
COPY ./tsconfig.json .
COPY ./src ./src

USER root
RUN npm ci
RUN npm run build

USER pptruser
RUN npx puppeteer browsers install chrome
ENTRYPOINT ["node", "build/index.js"]