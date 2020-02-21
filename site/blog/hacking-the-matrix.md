---
title: 'Hacking the (Minecraft) Matrix with JRuby'
date: 2013-04-25
featured_image: /images/blog/hacking-the-matrix.jpg
tags:
  - blog
  - jruby
---

If you have children of a certain age, or are a child at heart yourself, you have probably come across [Minecraft](http://www.minecraft.net), a wonderful game that proves that gameplay and creativity can still trump fancy graphics, explosions, and photoreal environments.

Minecraft is all about building things, but you build in the game, using only the tools that the game's creator gives you. After having mastered the game from the inside, my sons wanted to **see the matrix**. They wanted to know how it worked, and **change it**, and come up with their own tools and their own rules. So, after poking around a bit, I discovered that Minecraft is written in Java, and there is a huge community of people who mod the game. But Java is not the best language to teach my 9 year old, so a bit more digging brought me to this awesome project by one the JRuby guys, [Purugin](https://github.com/enebo/Purugin). This lets you program Minecraft using Ruby, which sounds like a whole lot of fun, so let's get started.

(These instructions assume you are on OSX. The same ideas should translate over to Windows as well.)

First, go to [Minecraft](http://www.minecraft.net) and download (and purchase) the desktop client, and get that working on its own.

Next, we need to get the [CraftBukkit](http://bukkit.org) server, which will hold our world and our custom code, and we will eventually connect our clients to this server.

```bash
mkdir ~/Code/CraftBukkit
cd ~/Code/CraftBukkit
curl -L http://dl.bukkit.org/downloads/craftbukkit/get/02084_1.5.1-R0.2/craftbukkit-beta.jar > craftbukkit.jar
echo "cd ~/Code/CraftBukkit" > start.sh
echo "java -Xms1024M -Xmx1024M -jar craftbukkit.jar -o true" >> start.sh
chmod +x start.sh

mkdir plugins
cd plugins
curl -LO http://dev.bukkit.org/media/files/675/889/purugin-1.4.7-R1.0.1-bukkit-1.4.7-R1.0-SNAPSHOT.jar
curl -LO https://github.com/enebo/Purugin/raw/master/examples/generators/cube.rb
curl -LO https://github.com/enebo/Purugin/raw/master/examples/generators/tunnel.rb
curl -LO https://github.com/enebo/Purugin/raw/master/examples/purogo.rb
mkdir purogo
cd purogo
curl -LO https://github.com/enebo/Purugin/raw/master/examples/purogo/tower.rb
curl -LO https://github.com/enebo/Purugin/raw/master/examples/purogo/pyramid.rb
curl -LO https://github.com/enebo/Purugin/raw/master/examples/purogo/star.rb
curl -LO https://github.com/enebo/Purugin/raw/master/examples/purogo/cube.rb
```

Now, let's start the server:

```bash
~/Code/CraftBukkit/start.sh
```

You should see the server start up. Make sure you see lines like this in the output, which indicate that the JRuby plugins loaded OK:

```
08:31:54 [INFO] [PuruginPlugin] Loading PuruginPlugin v1.4.7-R1.0.1
08:32:05 [INFO] [PuruginPlugin] Enabling PuruginPlugin v1.4.7-R1.0.1
08:32:05 [INFO] [Cube Generator] version 0.2 ENABLED
08:32:05 [INFO] [purogo] version 0.2 ENABLED
08:32:05 [INFO] [Tunnel Generator] version 0.1 ENABLED
08:32:05 [INFO] Done (8.607s)! For help, type "help" or "?"
>
```

At this point, you can run the Minecraft client App, and say Multiplayer -> Direct Connect to localhost, and you should connect to our server.

As you are playing Minecraft, you can issue commands by typing `/`, so lets try our first command by typing this in the Minecraft client:

```
/cube 5 5 5
```

This will create a 5-block cube in front of you. The code that made that happen is here

###cube.rb

```ruby
class CubeGenerationPlugin
  include Purugin::Plugin
  description 'Cube Generator', 0.2

  def on_enable
    public_command('cube', 'make n^3 cube of type', '/cube {dim}') do |me, *args|
      dim = error? args[0].to_i, "Must specify an integer size"
      error? dim > 0, "Size must be an integer >0"
      type = args.length > 1 ? args[1].to_sym : :glass
      z_block = error? me.target_block.block_at(:up), "No block targeted"

      me.msg "Creating cube of #{type} and size #{dim}"
      dim.times do
        y_block = z_block
        dim.times do
          x_block = y_block
          dim.times do
            x_block.change_type type
            x_block = x_block.block_at(:north)
          end
          y_block = y_block.block_at(:east)
        end
        z_block = z_block.block_at(:up)
      end
      me.msg "Done creating cube of #{type} and size #{dim}"
    end
  end
end
```

Any `.rb` file you put in the `~/Code/CraftBukkit/plugins` directory, will be automatically picked up and available for you to call.

So, that's great, and it's Ruby, which is a bit nicer (IMHO) than Java, however it's still a bit beyond my 9-year-old son. Luckily, there is also a simple Logo implementation available to us, so that in Minecraft we can type

```
/draw tower
```

and you should see a chicken drawing a tower in front of you. The code that does this, is

```ruby
turtle("tower") do
  # Draw base of cube
  square do
    4.times do |i|
      mark i
      forward 5
      turnleft 90
    end
  end

  pillars do
    4.times do |i|
      goto i
      turnup 90
      forward 5
    end # Still at top of last pillar
    turndown 90
  end

  3.times do
    square
    pillars
  end
  square
end
```

Ahh, a much nicer syntax for a child to grasp, and they can see their creation come to life in front of them, which is highly motivating.

Any `.rb` file (written in the Logo-ish syntax) you put in `~/Code/CraftBukkit/plugins/purogo` will be available to call with the `/draw` command.

So, we have barely scatched the surface of what can be done, but it is wonderful to see a child's eyes light up the first time they "hack the matrix" and write code that creates something they can actually see in the Minecraft world. Many thanks to [Tom Enebo](http://blog.enebo.com/2011/05/purugin.html) for creating Purugin, and hopefully sparking an interest in programming in our children.
