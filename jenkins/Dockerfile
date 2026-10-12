# Jenkins controller with the tools the Jenkinsfile needs:
#   Node.js 24 (tests, frontend build, JSON parsing in scripts), Docker CLI +
#   buildx (image builds, run against the docker:dind sidecar) and Terraform.
#   git and curl are already part of the official Jenkins image.
# Tools are copied from their official multi-architecture images, so this
# works on Intel and Apple Silicon Macs.

FROM node:24-bookworm-slim AS node
FROM docker:cli AS dockercli
FROM hashicorp/terraform:1.16.5 AS terraform

FROM jenkins/jenkins:lts-jdk21

USER root

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx

COPY --from=terraform /bin/terraform /usr/local/bin/terraform

USER jenkins

COPY --chown=jenkins:jenkins plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
