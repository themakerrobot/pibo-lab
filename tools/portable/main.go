// Pibo Lab portable — the whole site embedded in one exe.
package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os/exec"
	"time"
)

//go:embed all:site
var siteFS embed.FS

const basePort = 50030

func main() {
	sub, _ := fs.Sub(siteFS, "site")

	port := basePort
	var ln net.Listener
	var err error
	for i := 0; i < 10; i++ {
		ln, err = net.Listen("tcp", fmt.Sprintf("localhost:%d", port))
		if err == nil {
			break
		}
		port++
	}
	if ln == nil {
		fmt.Println("no free port found near", basePort)
		fmt.Scanln()
		return
	}

	url := fmt.Sprintf("http://localhost:%d", port)
	fmt.Println("Pibo Lab -", url)
	fmt.Println("Close this window to stop.")

	go func() {
		time.Sleep(600 * time.Millisecond)
		exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	}()

	http.Serve(ln, http.FileServer(http.FS(sub)))
}
