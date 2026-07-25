{pkgs}: {
  channel = "stable-24.11";
  packages = [
    pkgs.nodejs_20
    pkgs.zulu
  ];
  env = {
    PORT = "3000"; # Changed to 3000
  };
  services.firebase.emulators = {
    detect = false;
    projectId = "demo-app";
    services = ["auth" "firestore"];
  };
  idx = {
    extensions = [];
    workspace = {
      onCreate = {
        default.openFiles = [
          "src/app/page.tsx"
        ];
      };
    };
    previews = {
      enable = true;
      previews = {
        web = {
          # Updated to 3000
          command = ["npm" "run" "dev" "--" "--port" "3000" "--hostname" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}