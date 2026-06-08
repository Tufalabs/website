{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      pkgs = nixpkgs.legacyPackages.aarch64-darwin;
      jekyllArgs = "--config site/_config.yml --source site --destination build";
    in
    {
      devShells.aarch64-darwin.default = pkgs.mkShell {
        packages = with pkgs; [
          ruby_3_4
          bundler
          just
          pkg-config
          libffi
          libyaml
          openssl

          (writeShellScriptBin ",install" "bundle install")
          (writeShellScriptBin ",build" ''
            bundle exec jekyll clean ${jekyllArgs}
            bundle exec jekyll build ${jekyllArgs}
          '')
          (writeShellScriptBin ",serve" ''
            bundle exec jekyll serve ${jekyllArgs} --host 127.0.0.1 --port 4000
          '')
        ];
      };
    };
}
