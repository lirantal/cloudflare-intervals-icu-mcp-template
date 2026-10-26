# syntax=docker/dockerfile:1
FROM golang:1.26.10-bookworm AS build
# Immutable upstream source; review this pin and go.mod together when updating.
ARG ICUVISOR_COMMIT=069f893e91819a454da80015df8f2ae6158707ae
WORKDIR /src
# proxy_ca is optional for normal machines; used by the managed build environment.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export GIT_SSL_CAINFO=/run/secrets/proxy_ca; fi; \
    git init . && git remote add origin https://github.com/ricardocabral/icuvisor.git && \
    git fetch --depth=1 origin "$ICUVISOR_COMMIT" && git checkout --detach FETCH_HEAD && \
    test "$(git rev-parse HEAD)" = "$ICUVISOR_COMMIT"
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export SSL_CERT_FILE=/run/secrets/proxy_ca; fi; \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=$ICUVISOR_COMMIT" -o /out/icuvisor ./cmd/icuvisor
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/icuvisor /usr/local/bin/icuvisor
COPY --from=build /src/LICENSE /usr/share/doc/icuvisor/LICENSE
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/icuvisor"]
CMD ["--transport", "http", "--http-bind", "0.0.0.0:8080"]
