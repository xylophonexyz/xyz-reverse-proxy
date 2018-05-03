FROM node:alpine
WORKDIR /root/xyz-url-rewrite-proxy
COPY .env package.json package-lock.json ./
RUN apk add --update \
    python \
    python-dev \
    py-pip \
    build-base \
  && pip install virtualenv \
  && rm -rf /var/cache/apk/*
RUN npm install
COPY . .
EXPOSE 8080
EXPOSE 8443
CMD ["npm", "start"]