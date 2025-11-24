# Makefile - helper targets for development and quick production testing

.PHONY: clean-install-webapp

# Clean install and build the webapp (safe wrapper around npm script)
clean-install-webapp:
	@echo "Running clean install + build for webapp..."
	cd webapp && npm run clean-install

# Package built webapp into webapp-dist tarball
.PHONY: package-webapp-dist
package-webapp-dist:
	@echo "Packaging webapp/dist into webapp-dist/webapp-dist.tgz"
	mkdir -p webapp-dist
	tar -C webapp -czf webapp-dist/webapp-dist.tgz dist
	@echo "Packaged -> webapp-dist/webapp-dist.tgz"
