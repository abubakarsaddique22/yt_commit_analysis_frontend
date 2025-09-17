// popup.js
document.addEventListener("DOMContentLoaded", async () => {
  const outputDiv = document.getElementById("output");
  const API_URL = 'http://localhost:5000';
  const API_KEY = 'AIzaSyBiejARZ6TOzSjuQBwu1yk40CTbWoIbZMI'; // YouTube API key

  // popup.js


  // Get the current tab's URL
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const url = tabs[0].url;
    const youtubeRegex = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/;
    const match = url.match(youtubeRegex);

    if (!match || !match[1]) {
      outputDiv.innerHTML = "<p>This is not a valid YouTube URL.</p>";
      return;
    }

    const videoId = match[1];
    outputDiv.innerHTML = `<div class="section-title">YouTube Video ID</div><p>${videoId}</p><p>Fetching comments...</p>`;

    // Fetch comments
    const comments = await fetchComments(videoId);
    if (comments.length === 0) {
      outputDiv.innerHTML += "<p>No comments found for this video.</p>";
      return;
    }

    outputDiv.innerHTML += `<p>Fetched ${comments.length} comments. Performing sentiment analysis...</p>`;

    // Fetch sentiment predictions with timestamps
    const predictions = await getSentimentPredictions(comments);
    if (!predictions) return;

    // Calculate sentiment metrics
    const sentimentCounts = { "1": 0, "0": 0, "-1": 0 };
    const sentimentData = [];
    let totalScore = 0;

    predictions.forEach(item => {
      sentimentCounts[item.sentiment]++;
      totalScore += parseInt(item.sentiment);
      sentimentData.push({
        timestamp: item.timestamp,
        sentiment: parseInt(item.sentiment)
      });
    });

    const totalComments = comments.length;
    const avgScore = (totalScore / totalComments).toFixed(2);
    const totalWords = comments.reduce((sum, c) => sum + c.text.split(/\s+/).length, 0);
    const avgWords = (totalWords / totalComments).toFixed(2);
    const uniqueCommenters = new Set(comments.map(c => c.authorId)).size;
    const normalizedScore = (((parseFloat(avgScore) + 1) / 2) * 10).toFixed(2);

    // Display summary metrics
    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">Comment Analysis Summary</div>
        <div class="metrics-container">
          <div class="metric">
            <div class="metric-title">Total Comments</div>
            <div class="metric-value">${totalComments}</div>
          </div>
          <div class="metric">
            <div class="metric-title">Unique Commenters</div>
            <div class="metric-value">${uniqueCommenters}</div>
          </div>
          <div class="metric">
            <div class="metric-title">Avg Comment Length</div>
            <div class="metric-value">${avgWords} words</div>
          </div>
          <div class="metric">
            <div class="metric-title">Avg Sentiment Score</div>
            <div class="metric-value">${normalizedScore}/10</div>
          </div>
        </div>
      </div>
    `;

    // Display charts and wordcloud
    outputDiv.innerHTML += `
      <div class="section">
        <div class="section-title">Sentiment Analysis Results</div>
        <div id="chart-container"></div>
      </div>
      <div class="section">
        <div class="section-title">Sentiment Trend Over Time</div>
        <div id="trend-graph-container"></div>
      </div>
      <div class="section">
        <div class="section-title">Comment Wordcloud</div>
        <div id="wordcloud-container"></div>
      </div>
      <div class="section">
        <div class="section-title">Top 25 Comments with Sentiments</div>
        <ul class="comment-list">
          ${predictions.slice(0, 25).map((item, idx) => `
            <li class="comment-item">
              <span>${idx + 1}. ${item.comment}</span><br>
              <span class="comment-sentiment">Sentiment: ${item.sentiment}</span>
            </li>`).join('')}
        </ul>
      </div>
    `;

    // Fetch and display visualizations
    await fetchAndDisplayChart(sentimentCounts);
    await fetchAndDisplayTrendGraph(sentimentData);
    await fetchAndDisplayWordCloud(comments.map(c => c.text));
  });

  async function fetchComments(videoId) {
    let comments = [];
    let pageToken = "";
    try {
      while (comments) {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&pageToken=${pageToken}&key=${API_KEY}`);
        const data = await res.json();
        if (data.items) {
          data.items.forEach(item => {
            const commentText = item.snippet.topLevelComment.snippet.textOriginal;
            const timestamp = item.snippet.topLevelComment.snippet.publishedAt;
            const authorId = item.snippet.topLevelComment.snippet.authorChannelId?.value || 'Unknown';
            comments.push({ text: commentText, timestamp, authorId });
          });
        }
        pageToken = data.nextPageToken;
        if (!pageToken) break;
      }
    } catch (err) {
      console.error("Error fetching comments:", err);
      outputDiv.innerHTML += "<p>Error fetching comments.</p>";
    }
    return comments;
  }

  async function getSentimentPredictions(comments) {
    try {
      const res = await fetch(`${API_URL}/predict_with_timestamps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments })
      });
      const result = await res.json();
      if (res.ok) return result;
      throw new Error(result.error || 'Error fetching predictions');
    } catch (err) {
      console.error("Error fetching predictions:", err);
      outputDiv.innerHTML += "<p>Error fetching sentiment predictions.</p>";
      return null;
    }
  }

  async function fetchAndDisplayChart(sentimentCounts) {
    try {
      const res = await fetch(`${API_URL}/generate_chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentiment_counts: sentimentCounts })
      });
      const blob = await res.blob();
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.style.width = '100%';
      img.style.marginTop = '20px';
      document.getElementById('chart-container').appendChild(img);
    } catch (err) {
      console.error("Error fetching chart:", err);
      outputDiv.innerHTML += "<p>Error fetching chart image.</p>";
    }
  }

  async function fetchAndDisplayTrendGraph(sentimentData) {
    try {
      const res = await fetch(`${API_URL}/generate_trend_graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentiment_data: sentimentData })
      });
      const blob = await res.blob();
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.style.width = '100%';
      img.style.marginTop = '20px';
      document.getElementById('trend-graph-container').appendChild(img);
    } catch (err) {
      console.error("Error fetching trend graph:", err);
      outputDiv.innerHTML += "<p>Error fetching trend graph image.</p>";
    }
  }

  async function fetchAndDisplayWordCloud(comments) {
    try {
      const res = await fetch(`${API_URL}/generate_wordcloud`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments })
      });
      const blob = await res.blob();
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.style.width = '100%';
      img.style.marginTop = '20px';
      document.getElementById('wordcloud-container').appendChild(img);
    } catch (err) {
      console.error("Error fetching wordcloud:", err);
      outputDiv.innerHTML += "<p>Error fetching word cloud image.</p>";
    }
  }
});
