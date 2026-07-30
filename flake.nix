{
  description = "Aether Shell - glassmorphic GTK4/Wayland desktop shell with an API-key driven AI agent";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    astal = {
      url = "github:aylur/astal";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    ags = {
      url = "github:aylur/ags";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.astal.follows = "astal";
    };
  };

  outputs = { self, nixpkgs, astal, ags, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f system nixpkgs.legacyPackages.${system});
    in
    {
      packages = forAll (system: pkgs: {
        default = ags.lib.bundle {
          inherit pkgs;
          src = ./.;
          name = "aether-shell";
          entry = "app.ts";

          extraPackages = with astal.packages.${system}; [
            io
            astal4
            apps
            battery
            bluetooth
            hyprland
            network
            notifd
            tray
            wireplumber
          ] ++ (with pkgs; [
            curl
            libsecret
            brightnessctl
            wl-clipboard
          ]);
        };
      });

      devShells = forAll (system: pkgs: {
        default = pkgs.mkShell {
          packages = [
            ags.packages.${system}.default
            pkgs.gjs
            pkgs.gtk4
            pkgs.gtk4-layer-shell
            pkgs.dart-sass
            pkgs.nodejs
            pkgs.jq
            pkgs.curl
          ];
        };
      });

      homeManagerModules.default = { config, lib, pkgs, ... }:
        let cfg = config.programs.aether-shell;
        in {
          options.programs.aether-shell = {
            enable = lib.mkEnableOption "Aether Shell";
            package = lib.mkOption {
              type = lib.types.package;
              default = self.packages.${pkgs.system}.default;
            };
            settings = lib.mkOption {
              type = lib.types.attrs;
              default = { };
              description = "Written to ~/.config/aether/config.json. Never put API keys here.";
            };
          };

          config = lib.mkIf cfg.enable {
            home.packages = [ cfg.package ];

            xdg.configFile."aether/config.json" = lib.mkIf (cfg.settings != { }) {
              text = builtins.toJSON cfg.settings;
            };

            systemd.user.services.aether-shell = {
              Unit = {
                Description = "Aether Shell";
                PartOf = [ "graphical-session.target" ];
              };
              Service = {
                ExecStart = "${cfg.package}/bin/aether-shell";
                Restart = "on-failure";
              };
              Install.WantedBy = [ "graphical-session.target" ];
            };
          };
        };
    };
}
