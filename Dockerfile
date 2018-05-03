FROM node:boron
WORKDIR /root/xyz-url-rewrite-proxy
COPY .env package.json package-lock.json ./
RUN npm install
COPY . .
EXPOSE 8080
EXPOSE 8443
CMD ["npm", "start"]