terraform {
  required_version = ">= 1.6.0"

  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.9"
    }
  }

  # State is stored locally. Jenkins passes the file location at init time
  # (-backend-config="path=..."), so the state lives in the persistent Jenkins
  # volume instead of the build workspace. State files are git-ignored.
  backend "local" {}
}
