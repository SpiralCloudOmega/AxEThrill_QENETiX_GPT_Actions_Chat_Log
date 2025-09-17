# Tutorial: Creating Your First GPT Action

**Date**: 2024-01-20
**Topic**: Step-by-step guide for beginners

## Introduction

This tutorial will walk you through creating your first GPT Action from scratch.

## Prerequisites

- Access to ChatGPT Plus or Enterprise
- Basic understanding of APIs
- A web service with a REST API (we'll use a simple weather API)

## Step 1: Design Your Action

**User**: I want to create a GPT Action that can fetch weather data. Where should I start?

**Assistant**: Great choice! Weather APIs are perfect for learning GPT Actions. Here's how to start:

1. **Choose an API**: For this tutorial, we'll use OpenWeatherMap API
2. **Plan the functionality**: We want to get current weather by city name
3. **Define the schema**: We need to specify the API endpoint, parameters, and response format

## Step 2: Create the OpenAPI Schema

**User**: How do I write the OpenAPI specification?

**Assistant**: Here's a basic OpenAPI schema for our weather action:

```yaml
openapi: 3.0.0
info:
  title: Weather API
  version: 1.0.0
servers:
  - url: https://api.openweathermap.org/data/2.5
paths:
  /weather:
    get:
      operationId: getCurrentWeather
      summary: Get current weather for a city
      parameters:
        - name: q
          in: query
          required: true
          schema:
            type: string
          description: City name
        - name: appid
          in: query
          required: true
          schema:
            type: string
          description: API key
      responses:
        '200':
          description: Weather data
          content:
            application/json:
              schema:
                type: object
```

**User**: That makes sense! What's next?

**Assistant**: Now you need to:

1. **Get an API key** from OpenWeatherMap
2. **Configure authentication** in ChatGPT
3. **Test your action** with a simple query

## Step 3: Testing

**User**: I've set everything up. How do I test it?

**Assistant**: Try asking: "What's the weather like in Paris?"

If configured correctly, I should be able to fetch and display the current weather data for Paris using your weather action.

## Conclusion

You've now created your first GPT Action! This foundation can be extended to work with any REST API.