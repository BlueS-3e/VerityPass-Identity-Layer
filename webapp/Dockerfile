FROM node:20-alpine AS build
WORKDIR /app
COPY webapp/package*.json ./
COPY webapp/package-lock.json ./
COPY webapp/ ./
RUN npm ci --production=false --silent
RUN npm run build

FROM nginx:1.26-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Default nginx config will serve the app; add custom conf if needed
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
