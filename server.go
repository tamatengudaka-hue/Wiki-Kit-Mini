package main

import (
	"log"
	"net/http"
)

func main() {
	const addr = "127.0.0.1:8080"

	server := &http.Server{
		Addr:    addr,
		Handler: http.FileServer(http.Dir(".")),
	}

	log.Printf("Wiki server started: http://%s", addr)

	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
