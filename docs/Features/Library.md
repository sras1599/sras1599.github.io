The idea of a library is to log every bit of media I've consumed. By posting something like this on the website, I also allow others to see what my preferences are and give me recommendations. It also allows me to be more informed when I give recommendations myself. I got this idea from Declan Chidlow's [awesome website](https://vale.rocks/library).

The library will host titles of content from multiple categories, and I intend to start with movies and books, since this is what I've consumed the most. Every piece of content will have a few required parameters and a few optional parameters.
### The structure
One main library page at `/library`, and one page each for each category (`library/movies`, for eg.)

The main page will have some content, which introduces the user to the library and some illustrated cards which take the user to a particular section/category in the library. The content for the main page and the category pages will come from obsidian, however it needs to have some dynamic elements, something I haven't figured out a strategy for yet.

The illustration cards currently look like this:
![[library-illustrations.png]]
### Rendering
#### Category discovery
